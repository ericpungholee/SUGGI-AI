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
  
  const planPrompt = new PromptTemplate({
    template: `Create a detailed instruction for this writing task.

Task: {task}
User Query: {userQuery}
Document Content: {documentContent}
Retrieved Context: {retrievedContext}
Needs: {needs}

Create a structured instruction that includes:
1. What to do (specific actions)
2. How to do it (approach and constraints)
3. What context to use (from retrieved context or document)
4. Quality requirements

Be specific and actionable.`,
    inputVariables: ['task', 'userQuery', 'documentContent', 'retrievedContext', 'needs']
  })

  try {
    const response = await llm.invoke([
      new SystemMessage("You are a writing task planner. Create clear, actionable instructions."),
      new HumanMessage(await planPrompt.format({
        task: state.task,
        userQuery: state.userQuery,
        documentContent: state.documentContent || '',
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
      instruction: `Execute the writing task: ${state.userQuery}`,
      error: `Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Execution node - generates preview operations
async function executeNode(state: WriterAgentState): Promise<Partial<WriterAgentState>> {
  console.log('🔄 LangGraph: Executing task...')
  
  const executePrompt = new PromptTemplate({
    template: `Execute this writing task and generate preview operations.

Instruction: {instruction}
Document Content: {documentContent}
Retrieved Context: {retrievedContext}

Generate preview operations in this format:
{{
  "ops": [
    {{
      "type": "insert_after" | "replace_range" | "format" | "table_create" | "table_edit",
      "text": "content to insert/replace",
      "range": {{"start": 0, "end": 10}},
      "formatting": {{"bold": true, "italic": false}},
      "citations": ["source1", "source2"]
    }}
  ],
  "summary": "Brief description of changes"
}}

Be precise with ranges and provide accurate citations.`,
    inputVariables: ['instruction', 'documentContent', 'retrievedContext']
  })

  try {
    const response = await llm.invoke([
      new SystemMessage("You are a writing executor. Generate precise preview operations in JSON format."),
      new HumanMessage(await executePrompt.format({
        instruction: state.instruction || '',
        documentContent: state.documentContent || '',
        retrievedContext: state.retrievedContext || ''
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
      previewOps: parsed.ops || [],
      approvalMessage: parsed.summary || 'Preview operations generated'
    }
  } catch (error) {
    console.error('Execution error:', error)
    return {
      previewOps: [],
      approvalMessage: 'Failed to generate preview operations',
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
