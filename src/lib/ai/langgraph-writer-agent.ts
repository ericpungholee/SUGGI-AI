import { StateGraph, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { Document } from '@langchain/core/documents'
import { prisma } from '@/lib/prisma'

// Helper function to get relevant documents
async function getRelevantDocuments(
  query: string,
  userId: string,
  documentIds?: string[],
  limit: number = 5
): Promise<Document[]> {
  try {
    // Get user's documents
    const documents = await prisma.document.findMany({
      where: {
        userId,
        isVectorized: true,
        isDeleted: false,
        ...(documentIds && { id: { in: documentIds } })
      },
      select: {
        id: true,
        title: true,
        plainText: true,
        content: true
      }
    })

    if (documents.length === 0) {
      return []
    }

    // Create documents for retrieval
    const langchainDocs = documents.map(doc => new Document({
      pageContent: doc.plainText || JSON.stringify(doc.content),
      metadata: {
        documentId: doc.id,
        documentTitle: doc.title,
        userId
      }
    }))

    // For now, return all documents (you can implement better filtering)
    return langchainDocs.slice(0, limit)
  } catch (error) {
    console.error('Document retrieval error:', error)
    return []
  }
}

// State interface for the LangGraph workflow
interface WriterAgentState {
  userQuery: string
  documentContent?: string
  documentId?: string
  userId: string
  
  // Routing
  task?: 'rewrite' | 'summarize' | 'extend' | 'outline' | 'critique' | 'fact_check' | 'reference_insert' | 'compare' | 'table_create' | 'table_edit'
  confidence?: number
  needs?: {
    selection_text: boolean
    doc_context: 'none' | 'local' | 'project' | 'workspace'
    web_context: 'no' | 'recommended' | 'required'
    precision: 'low' | 'medium' | 'high'
  }
  
  // Context and planning
  retrievedContext?: string
  instruction?: string
  constraints?: string[]
  
  // Execution
  previewOps?: any[]
  approvalMessage?: string
  
  // Metadata
  sources?: any[]
  processingTime?: number
  error?: string
}

// LLM instance for the workflow
const llm = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0.1,
  maxTokens: 2000
})

// Router node - determines task and needs
async function routeNode(state: WriterAgentState): Promise<Partial<WriterAgentState>> {
  console.log('🔄 LangGraph: Routing request...')
  
  const routerPrompt = new PromptTemplate({
    template: `Analyze this writing request and determine the task type and requirements.

User Query: {userQuery}
Document Context: {documentContent}
Web Search Available: {hasWebSearch}

Classify the task as one of: rewrite, summarize, extend, outline, critique, fact_check, reference_insert, compare, table_create, table_edit

Determine what context is needed:
- selection_text: Does it need the current selection?
- doc_context: none, local, project, or workspace?
- web_context: no, recommended, or required? (Set to "required" if web search data is available and task involves current information)
- precision: low, medium, or high?

Respond in JSON format:
{{
  "task": "task_type",
  "confidence": 0.0-1.0,
  "needs": {{
    "selection_text": boolean,
    "doc_context": "context_level",
    "web_context": "web_level", 
    "precision": "precision_level"
  }}
}}`,
    inputVariables: ['userQuery', 'documentContent', 'hasWebSearch']
  })

  try {
    const response = await llm.invoke([
      new SystemMessage("You are a writing task classifier. Respond only with valid JSON."),
      new HumanMessage(await routerPrompt.format({
        userQuery: state.userQuery,
        documentContent: state.documentContent || '',
        hasWebSearch: state.retrievedContext ? 'Yes' : 'No'
      }))
    ])

    // Parse JSON response, handling markdown code blocks
    let content = response.content as string
    if (content.includes('```json')) {
      content = content.match(/```json\n([\s\S]*?)\n```/)?.[1] || content
    } else if (content.includes('```')) {
      content = content.match(/```\n([\s\S]*?)\n```/)?.[1] || content
    }

    const parsed = JSON.parse(content)
    return {
      task: parsed.task,
      confidence: parsed.confidence,
      needs: parsed.needs
    }
  } catch (error) {
    console.error('Routing error:', error)
    return {
      task: 'rewrite',
      confidence: 0.5,
      needs: {
        selection_text: false,
        doc_context: 'local',
        web_context: 'no',
        precision: 'medium'
      },
      error: `Routing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Context retrieval node
async function retrieveContextNode(state: WriterAgentState): Promise<Partial<WriterAgentState>> {
  console.log('🔄 LangGraph: Retrieving context...')
  
  if (state.needs?.doc_context === 'none') {
    return { retrievedContext: '' }
  }

  try {
    // Use document retrieval for context (already integrated with vector search)
    const context = await getRelevantDocuments(
      state.userQuery,
      state.userId,
      state.documentId ? [state.documentId] : undefined,
      5
    )
    
    const contextText = context.map(doc => doc.pageContent).join('\n\n')
    
    return {
      retrievedContext: contextText,
      sources: context.map(doc => doc.metadata)
    }
  } catch (error) {
    console.error('Context retrieval error:', error)
    return {
      retrievedContext: '',
      error: `Context retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Planning node - creates detailed instruction
async function planNode(state: WriterAgentState): Promise<Partial<WriterAgentState>> {
  console.log('🔄 LangGraph: Planning execution...')
  
  // Analyze document structure
  const docContent = state.documentContent || ''
  const hasContent = docContent.trim().length > 0
  const docStructure = analyzeDocumentStructure(docContent)
  
  const planPrompt = new PromptTemplate({
    template: `Create a detailed instruction for this writing task.

Task: {task}
User Query: {userQuery}
Document Content: {documentContent}
Document Structure: {docStructure}
Retrieved Context: {retrievedContext}
Needs: {needs}

CRITICAL CONTEXT AWARENESS RULES:
1. If document has existing content, work WITH it, not replace it
2. Understand the document's structure (headings, paragraphs, lists, etc.)
3. Match the existing writing style and formatting
4. Insert content at the appropriate location based on context and user intent
5. NEVER rewrite the entire document unless explicitly asked
6. NEVER add content at the top by default - use cursor position or end of document
7. If user asks to "add" or "insert", place content where it makes sense contextually
8. If user asks to "improve" or "edit", modify existing content in place
9. Preserve document structure and formatting

Create a structured instruction that includes:
1. What to do (specific actions)
2. How to do it (approach and constraints - MUST respect existing content)
3. What context to use (from retrieved context or document)
4. Where to place content (cursor position, end, or specific section)
5. Quality requirements

Be specific and actionable.`,
    inputVariables: ['task', 'userQuery', 'documentContent', 'docStructure', 'retrievedContext', 'needs']
  })

  try {
    const response = await llm.invoke([
      new SystemMessage("You are a writing task planner. Create clear, actionable instructions that respect existing document content and structure."),
      new HumanMessage(await planPrompt.format({
        task: state.task,
        userQuery: state.userQuery,
        documentContent: docContent.substring(0, 5000), // Limit to first 5000 chars for context
        docStructure: docStructure,
        retrievedContext: state.retrievedContext || '',
        needs: JSON.stringify(state.needs)
      }))
    ])

    return {
      instruction: response.content as string
    }
  } catch (error) {
    console.error('Planning error:', error)
    return {
      instruction: `Execute the writing task: ${state.userQuery}. Work with existing content, don't replace it.`,
      error: `Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Helper function to analyze document structure
function analyzeDocumentStructure(content: string): string {
  if (!content || content.trim().length === 0) {
    return 'Empty document - new content'
  }
  
  const structure: string[] = []
  
  // Count headings
  const h1Count = (content.match(/<h1[^>]*>/gi) || []).length
  const h2Count = (content.match(/<h2[^>]*>/gi) || []).length
  const h3Count = (content.match(/<h3[^>]*>/gi) || []).length
  
  if (h1Count > 0) structure.push(`${h1Count} H1 heading(s)`)
  if (h2Count > 0) structure.push(`${h2Count} H2 heading(s)`)
  if (h3Count > 0) structure.push(`${h3Count} H3 heading(s)`)
  
  // Count paragraphs
  const pCount = (content.match(/<p[^>]*>/gi) || []).length
  if (pCount > 0) structure.push(`${pCount} paragraph(s)`)
  
  // Count lists
  const ulCount = (content.match(/<ul[^>]*>/gi) || []).length
  const olCount = (content.match(/<ol[^>]*>/gi) || []).length
  if (ulCount > 0) structure.push(`${ulCount} bullet list(s)`)
  if (olCount > 0) structure.push(`${olCount} numbered list(s)`)
  
  // Estimate word count
  const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = textContent.split(/\s+/).filter(Boolean).length
  if (wordCount > 0) structure.push(`~${wordCount} words`)
  
  return structure.length > 0 ? structure.join(', ') : 'Plain text document'
}

// Execution node - generates preview operations
async function executeNode(state: WriterAgentState): Promise<Partial<WriterAgentState>> {
  console.log('🔄 LangGraph: Executing task...')
  
  const docContent = state.documentContent || ''
  const hasContent = docContent.trim().length > 0
  
  const executePrompt = new PromptTemplate({
    template: `Execute this writing task and generate the content to insert.

Instruction: {instruction}
Document Content: {documentContent}
Retrieved Context: {retrievedContext}
Has Existing Content: {hasContent}

CRITICAL RULES FOR CONTENT GENERATION:
1. Generate ONLY the new content to be inserted - do NOT include the entire document
2. If document has existing content, generate content that works WITH it, not replaces it
3. Match the style and tone of existing content if present
4. Use proper HTML formatting (paragraphs, headings, lists, etc.)
5. Generate content that fits naturally into the document structure
6. If user asks to "add" or "insert", generate content appropriate for that location
7. If user asks to "improve" or "edit", generate improved version of relevant section
8. NEVER generate the entire document unless explicitly asked to rewrite everything
9. Generate content in HTML format with proper tags (<p>, <h1>, <h2>, <ul>, <ol>, <strong>, <em>, etc.)

SPECIAL HANDLING FOR DELETE/CLEAR COMMANDS:
- If the user asks to "delete all", "clear everything", "remove all content", "empty the document", or similar delete/clear commands, return an EMPTY string (no HTML, no content)
- For delete/clear operations, you should return nothing - just an empty string
- The system will interpret an empty string as a command to clear the document

Generate the content as HTML that can be directly inserted into the document.
For delete/clear commands, return an empty string.

Respond with ONLY the HTML content to be inserted (or empty string for delete/clear), nothing else.`,
    inputVariables: ['instruction', 'documentContent', 'retrievedContext', 'hasContent']
  })

  try {
    const response = await llm.invoke([
      new SystemMessage(`You are a writing executor. Generate HTML content that works with existing document content. 
Generate ONLY the new content to insert - never rewrite the entire document unless explicitly asked.`),
      new HumanMessage(await executePrompt.format({
        instruction: state.instruction || '',
        documentContent: hasContent ? docContent.substring(0, 3000) : '', // Limit context
        retrievedContext: state.retrievedContext || '',
        hasContent: hasContent ? 'Yes' : 'No'
      }))
    ])

    const generatedContent = (response.content as string).trim()
    
    // If agent returned empty string, it's a delete/clear command
    if (generatedContent === '' || generatedContent.length === 0) {
      const previewOps = [{
        type: 'delete_all',
        text: '',
        position: 'all'
      }]
      
      return {
        previewOps: previewOps,
        approvalMessage: 'Document cleared'
      }
    }
    
    // Clean up the content - remove any markdown code blocks or explanations
    let cleanContent = generatedContent
    if (cleanContent.includes('```html')) {
      cleanContent = cleanContent.match(/```html\n([\s\S]*?)\n```/)?.[1] || cleanContent
    } else if (cleanContent.includes('```')) {
      cleanContent = cleanContent.match(/```\n([\s\S]*?)\n```/)?.[1] || cleanContent
    }
    
    // Remove any explanatory text before/after HTML
    cleanContent = cleanContent.replace(/^[^<]*/, '').replace(/[^>]*$/, '')
    
    // If no HTML tags and content exists, wrap in paragraph
    if (!cleanContent.includes('<') && cleanContent.trim().length > 0) {
      cleanContent = `<p>${cleanContent}</p>`
    }
    
    // Create a simple insert operation
    const previewOps = [{
      type: 'insert',
      text: cleanContent,
      position: 'cursor' // Will be determined by cursor position in editor
    }]
    
    return {
      previewOps: previewOps,
      approvalMessage: `Generated ${cleanContent.length} characters of content`
    }
  } catch (error) {
    console.error('Execution error:', error)
    return {
      previewOps: [],
      approvalMessage: 'Failed to generate content',
      error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Main LangGraph workflow
export function createWriterAgentWorkflow() {
  const workflow = new StateGraph<WriterAgentState>({
    channels: {
      userQuery: { value: null },
      documentContent: { value: null },
      documentId: { value: null },
      userId: { value: null },
      task: { value: null },
      confidence: { value: null },
      needs: { value: null },
      retrievedContext: { value: null },
      instruction: { value: null },
      previewOps: { value: null },
      approvalMessage: { value: null },
      sources: { value: null },
      processingTime: { value: null },
      error: { value: null }
    }
  })

  // Add nodes
  workflow.addNode('route', routeNode)
  workflow.addNode('retrieve_context', retrieveContextNode)
  workflow.addNode('plan', planNode)
  workflow.addNode('execute', executeNode)

  // Add edges
  workflow.addEdge('route', 'retrieve_context')
  workflow.addEdge('retrieve_context', 'plan')
  workflow.addEdge('plan', 'execute')
  workflow.addEdge('execute', END)

  // Set entry point
  workflow.setEntryPoint('route')

  return workflow.compile()
}

// Main function to process writing requests
export async function processWritingRequest(
  userQuery: string,
  documentContent: string,
  documentId: string,
  userId: string,
  webSearchData?: {
    webSearchText: string;
    webSearchCitations: any[];
    forceWebSearch: boolean;
  }
): Promise<WriterAgentState> {
  const workflow = createWriterAgentWorkflow()
  
  const initialState: WriterAgentState = {
    userQuery,
    documentContent,
    documentId,
    userId,
    retrievedContext: webSearchData ? `
Web Search Results:
${webSearchData.webSearchText}

Sources:
${webSearchData.webSearchCitations.map((citation, index) => `${index + 1}. ${citation.title || citation.domain || 'Source'}: ${citation.url}`).join('\n')}
` : undefined,
    sources: webSearchData?.webSearchCitations || []
  }

  try {
    const result = await workflow.invoke(initialState)
    return result
  } catch (error) {
    console.error('Workflow execution error:', error)
    return {
      ...initialState,
      error: `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      previewOps: [],
      approvalMessage: 'Failed to process request'
    }
  }
}
