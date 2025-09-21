import { generateChatCompletion, ChatMessage } from './openai'
import { getDocumentContext } from './vector-search'
import { searchWeb, formatSearchResultsForAI } from './web-search'
import { classifyQuery } from './query-classifier'
import { prisma } from '@/lib/prisma'

export interface AIChatRequest {
  message: string
  userId: string
  documentId?: string
  connectedDocumentIds?: string[]
  conversationId?: string
  includeContext?: boolean
  useWebSearch?: boolean
  abortSignal?: AbortSignal
}

export interface AIChatResponse {
  message: string
  conversationId: string
  contextUsed?: string[]
  tokenUsage?: {
    prompt: number
    completion: number
    total: number
  }
  cancelled?: boolean
  editSuggestion?: {
    intent: string
    shouldProposeEdit: boolean
  }
  editRequest?: {
    intent: string
    scope: 'selection' | 'document'
    guardrails: {
      allowCodeEdits: boolean
      allowMathEdits: boolean
      preserveVoice: boolean
    }
  }
  toolCalls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: any
    }
  }>
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    documentId?: string
    contextUsed?: string[]
    tokenUsage?: any
  }
}

/**
 * Process AI chat request with document context
 */
export async function processAIChat(request: AIChatRequest): Promise<AIChatResponse> {
  try {
    const {
      message,
      userId,
      documentId,
      connectedDocumentIds = [],
      conversationId,
      includeContext = true,
      useWebSearch = false,
      abortSignal
    } = request

    // Check if operation was cancelled before starting
    if (abortSignal?.aborted) {
      return {
        message: 'Operation was cancelled',
        conversationId: conversationId || '',
        cancelled: true
      }
    }

    // Get or create conversation
    let conversation = conversationId 
      ? await getConversation(conversationId, userId)
      : await createConversation(userId, documentId)

    // Use AI-powered query classification
    const classification = await classifyQuery(message, documentId, conversation.messages)
    const isGeneralQuery = classification.isGeneralKnowledge
    const isFollowUp = classification.isFollowUp
    
    console.log('AI Query Classification:', {
      message,
      classification,
      documentId
    })

  // Check if this is an editing request using AI classification
  if (classification.isEditRequest && documentId) {
    const editRequest = detectEditRequest(message, documentId)
    console.log('AI Edit detection in chat:', { 
      message, 
      editRequest, 
      documentId,
      classification
    })
    
    console.log('Edit request detected, returning early with editRequest')
    return {
      message: 'I\'ll help you edit your document. Let me analyze the content and propose improvements.',
      conversationId: conversationId || '',
      editRequest
    }
  }

    // Get document context if requested using advanced RAG
    let context = ''
    let contextUsed: string[] = []
    let contextSource = 'document'
    
    // If user explicitly wants web search, use GPT-5's native web search
    if (useWebSearch) {
      // Don't provide any context - let GPT-5 use its native web search
      context = ''
      contextUsed = []
      contextSource = 'web'
    }
    // If user doesn't want web search, use document context for document queries
    else if (includeContext && !isGeneralQuery && !isFollowUp) {
      // Only search documents for non-general knowledge queries
      // Check for cancellation before context retrieval
      if (abortSignal?.aborted) {
        return {
          message: 'Operation was cancelled',
          conversationId: conversation.id,
          cancelled: true
        }
      }

      try {
        // Check for cancellation before context retrieval
        if (abortSignal?.aborted) {
          return {
            message: 'Operation was cancelled',
            conversationId: conversation.id,
            cancelled: true
          }
        }
        
        // Get context from current document and connected documents
        const allDocumentIds = [documentId, ...connectedDocumentIds].filter(Boolean) as string[]
        context = await getDocumentContext(message, userId, allDocumentIds, 8) // Increased context chunks
        if (context) {
          contextUsed = [context]
        }
      } catch (contextError) {
        if (abortSignal?.aborted) {
          return {
            message: 'Operation was cancelled',
            conversationId: conversation.id,
            cancelled: true
          }
        }
        console.warn('Context retrieval failed:', contextError)
        // Continue without context if retrieval fails
      }
    }
    // For general knowledge queries without web search, use model's general knowledge
    else if (isGeneralQuery) {
      // No context will be provided, AI will use its general knowledge
    }
    // For follow-up queries, use conversation history instead of document search
    else if (isFollowUp) {
      context = ''
      contextUsed = []
      contextSource = 'conversation'
    }


    // Build messages for AI
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt(context, documentId, connectedDocumentIds, contextSource, isGeneralQuery, false)
      },
      ...conversation.messages.slice(-10), // Last 10 messages for context
      {
        role: 'user',
        content: message
      }
    ]

    // Check for cancellation before AI generation
    if (abortSignal?.aborted) {
      return {
        message: 'Operation was cancelled',
        conversationId: conversation.id,
        cancelled: true
      }
    }

    // Generate AI response
    const startTime = Date.now()
    let response: any
    let aiMessage = 'I apologize, but I was unable to generate a response.'
    let responseTime = 0
    let toolCalls: any = undefined

    try {
      // No tools available for AI editing
      const tools: any[] = [];

      response = await generateChatCompletion(messages, {
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: process.env.OPENAI_CHAT_MODEL?.includes('gpt-5') ? 12000 : 2000, // GPT-5 nano: 400k context, 128k max output
        abortSignal, // Pass abort signal to OpenAI
        useWebSearch, // Pass web search flag
        tools // Pass tools for function calling
      })

      // Debug logging removed for production

      const choice = response.choices[0]
      aiMessage = choice?.message?.content || 'I apologize, but I was unable to generate a response.'
      
      // Debug: Check if AI is generating pipe characters
      if (aiMessage.includes('|')) {
        console.log('🚨 AI generated pipe characters:', {
          originalLength: aiMessage.length,
          pipeCount: (aiMessage.match(/\|/g) || []).length,
          preview: aiMessage.substring(0, 200) + '...',
          fullContent: aiMessage
        })
      }
      
      // Clean up any pipe characters that might cause blue line artifacts
      aiMessage = aiMessage
        .replace(/\|+/g, '') // Remove pipe characters that cause blue line artifacts
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
      
      responseTime = Date.now() - startTime

      // Extract tool calls if present
      toolCalls = choice?.message?.tool_calls || undefined
    } catch (generationError) {
      if (abortSignal?.aborted) {
        return {
          message: 'Operation was cancelled',
          conversationId: conversation.id,
          cancelled: true
        }
      }
      console.error('AI generation failed:', generationError)
      throw generationError
    }

    // Response generated successfully

    // Save messages to conversation
    const userMessage: ConversationMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: new Date(),
      metadata: { documentId }
    }

    const assistantMessage: ConversationMessage = {
      id: generateId(),
      role: 'assistant',
      content: aiMessage,
      timestamp: new Date(),
      metadata: {
        documentId,
        contextUsed,
        tokenUsage: response.usage
      }
    }

    await saveMessages(conversation.id, [userMessage, assistantMessage])

    return {
      message: aiMessage,
      conversationId: conversation.id,
      contextUsed,
      tokenUsage: response.usage ? {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
        total: response.usage.total_tokens
      } : undefined,
      toolCalls
    }
  } catch (error) {
    console.error('Error processing AI chat:', error)
    throw new Error('Failed to process AI chat request')
  }
}

/**
 * Get conversation by ID
 */
async function getConversation(conversationId: string, userId: string) {
  const conversation = await prisma.aIConversation.findFirst({
    where: {
      id: conversationId,
      userId
    }
  })

  if (!conversation) {
    throw new Error('Conversation not found')
  }

  return {
    id: conversation.id,
    messages: conversation.messages as ConversationMessage[]
  }
}

/**
 * Create new conversation
 */
async function createConversation(userId: string, documentId?: string) {
  const conversation = await prisma.aIConversation.create({
    data: {
      userId,
      documentId,
      messages: []
    }
  })

  return {
    id: conversation.id,
    messages: []
  }
}

/**
 * Save messages to conversation
 */
async function saveMessages(conversationId: string, messages: ConversationMessage[]) {
  const conversation = await prisma.aIConversation.findUnique({
    where: { id: conversationId }
  })

  if (!conversation) {
    throw new Error('Conversation not found')
  }

  const existingMessages = conversation.messages as ConversationMessage[]
  const updatedMessages = [...existingMessages, ...messages]

  await prisma.aIConversation.update({
    where: { id: conversationId },
    data: {
      messages: updatedMessages,
      updatedAt: new Date()
    }
  })
}

// Note: Query classification is now handled by AI-powered classifyQuery function
// The old hardcoded regex patterns have been removed in favor of intelligent classification

/**
 * Build system prompt with context
 */
function buildSystemPrompt(context: string, documentId?: string, connectedDocumentIds: string[] = [], contextSource: string = 'document', isGeneralQuery: boolean = false, isEditRequest: boolean = false): string {
  let prompt = `You are an advanced AI writing assistant specialized in Retrieval-Augmented Generation (RAG). You excel at understanding document context, providing accurate information, and helping with complex writing tasks.

Your capabilities:
- Analyze and understand document content with high accuracy using retrieved context
- Answer questions based on retrieved context with proper citations and source attribution
- Help improve writing quality, grammar, and style based on document content
- Generate content that's contextually relevant and well-structured
- Provide research assistance with proper source attribution
- Suggest improvements and alternatives with clear reasoning
- Synthesize information from multiple document sources when available
- Answer general knowledge questions using web search results when document context is not available
- Provide intelligent document editing suggestions and improvements
- Detect when users want to edit their documents and offer editing assistance
- Directly edit and modify document content when requested
- Make precise text changes, improvements, and corrections
- Create and edit tables with specified dimensions and content
- Generate structured data in table format
- Modify existing tables by adding/removing rows and columns
- Format data into organized table layouts

Guidelines for accuracy and context usage:
- ALWAYS prioritize information from the provided context over general knowledge
- When document context is provided, base your responses primarily on it and cite specific sources
- When web search context is provided, use the search results to answer general knowledge questions
- Use direct quotes from the context when appropriate, with proper attribution
- If the context contains multiple documents or sources, clearly distinguish between them in your responses
- When no context is available, clearly state this limitation and provide general assistance based on your training knowledge
- Be specific and actionable in your suggestions, always explaining your reasoning
- Maintain a professional but approachable tone
- Be precise and avoid making assumptions not supported by the context
- When suggesting changes, explain your reasoning and reference specific parts of the context

IMPORTANT - Source Citation Rules:
- When citing document sources, ALWAYS refer to documents by their TITLE/NAME, never by ID
- When citing web sources, use phrases like "According to [Source Title]" or "As mentioned in [Source Title]"
- Use phrases like "According to [Document Title]" or "As mentioned in [Document Title]" for documents
- If you need to reference specific sections, say "In [Source Title], section X" or "From [Source Title]"
- Never mention document IDs, internal references, or technical identifiers to the user

Response format:
- Start with a direct answer to the user's question
- Support your answer with specific references to the context using source TITLES
- Provide additional insights or suggestions when relevant
- End with actionable next steps if appropriate

IMPORTANT - Editing Requests:
- When users ask to edit, improve, fix, or modify their document, you CAN and SHOULD help them
- You have full editing capabilities and can make direct changes to document content
- Always offer to help with editing requests rather than saying you cannot modify content
- Be proactive in suggesting improvements and offering to implement them
- When generating content for documents, generate ONLY substantive content - no meta-commentary
- Do NOT include phrases like "Here's the content", "I've generated", "This document", etc.
- Write as if you are the author of the document, not an AI assistant
- Generate natural content that continues or builds upon existing content seamlessly
- Avoid referencing the document title or structure in a meta way when generating content
- If asked to delete content, generate empty content or a fresh start

IMPORTANT - Table Creation and Editing:
- When users request table creation, generate proper HTML table markup with the specified dimensions
- Use the format: <table class="editor-table" data-table="true"><tbody><tr><td contenteditable="true" data-table-cell="true">content</td></tr></tbody></table>
- Always include proper table attributes: class="editor-table", data-table="true", data-table-cell="true"
- For table headers, use <th> elements instead of <td> in the first row
- When editing existing tables, preserve the table structure and only modify cell content
- For table modifications (add/remove rows/columns), generate the complete updated table HTML
- Include meaningful content in table cells based on the user's request
- Ensure tables are properly formatted and ready for immediate use in the editor

`

  if (context) {
    if (contextSource === 'web') {
      prompt += `\n\n=== WEB SEARCH RESULTS ===\n${context}\n\nCRITICAL INSTRUCTIONS FOR WEB SEARCH RESULTS:
- You MUST use the information from these web search results to answer the user's question
- Base your response primarily on the content provided in the search results above
- When citing information, use the exact titles from the search results (e.g., "According to [Title]")
- Include specific details, facts, and data from the search results
- If the search results contain multiple sources, reference them appropriately
- Do NOT provide generic responses - use the specific information provided
- If you need to make inferences, clearly state that you're drawing conclusions based on the available search results`
    } else {
      prompt += `\n\n=== RELEVANT DOCUMENT CONTEXT ===\n${context}\n\nIMPORTANT: Use this context as your primary source of information. When citing sources, ALWAYS use the document TITLES (the text in bold **Title**) that appear in the context above, never use document IDs or internal references. If you need to make inferences, clearly state that you're drawing conclusions based on the available context.`
    }
  } else {
    if (contextSource === 'web') {
      prompt += `\n\nIMPORTANT: The user has requested web search for current information. You have access to the web_search_preview tool with high search context. Use this tool to search the web for the most current and accurate information to answer the user's question. Provide recent information with proper citations from your web search results.`
    } else if (isGeneralQuery) {
      prompt += `\n\nYou are answering a general knowledge question. Use your training knowledge to provide a comprehensive and accurate response. You do not have access to specific document context or web search results, so base your answer on your general knowledge.`
    } else {
      prompt += `\n\nWARNING: No specific context was retrieved for this query. You can still provide helpful assistance based on your general knowledge, but you MUST clearly state that you don't have access to specific context and that your response is based on general knowledge only.`
    }
  }

  if (documentId || connectedDocumentIds.length > 0) {
    const allDocIds = [documentId, ...connectedDocumentIds].filter(Boolean)
    prompt += `\n\nNote: You are currently helping with ${allDocIds.length} document(s). If you cannot access the specific content of these documents in the context above, explain that the document content is not currently available and suggest that the user may need to re-vectorize the documents.`
  }

  return prompt
}

/**
 * Get conversation history
 */
export async function getConversationHistory(
  conversationId: string,
  userId: string,
  limit: number = 50
): Promise<ConversationMessage[]> {
  try {
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id: conversationId,
        userId
      }
    })

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const messages = conversation.messages as ConversationMessage[]
    return messages.slice(-limit)
  } catch (error) {
    console.error('Error getting conversation history:', error)
    throw new Error('Failed to get conversation history')
  }
}

/**
 * Get user's conversations
 */
export async function getUserConversations(
  userId: string,
  limit: number = 20
): Promise<Array<{
  id: string
  documentId?: string
  lastMessage?: string
  updatedAt: Date
}>> {
  try {
    const conversations = await prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        documentId: true,
        messages: true,
        updatedAt: true
      }
    })

    return conversations.map(conv => {
      const messages = conv.messages as ConversationMessage[]
      const lastMessage = messages.length > 0 
        ? messages[messages.length - 1].content.substring(0, 100) + '...'
        : undefined

      return {
        id: conv.id,
        documentId: conv.documentId,
        lastMessage,
        updatedAt: conv.updatedAt
      }
    })
  } catch (error) {
    console.error('Error getting user conversations:', error)
    throw new Error('Failed to get user conversations')
  }
}

/**
 * Delete conversation
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    await prisma.aIConversation.deleteMany({
      where: {
        id: conversationId,
        userId
      }
    })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    throw new Error('Failed to delete conversation')
  }
}



/**
 * Detect if a message is an editing request
 */
function detectEditRequest(message: string, documentId?: string): {
  intent: string
  scope: 'selection' | 'document'
  guardrails: {
    allowCodeEdits: boolean
    allowMathEdits: boolean
    preserveVoice: boolean
  }
} | null {
  const lowerMessage = message.toLowerCase()
  
  // Check for explicit chat mode requests first
  const chatModeIndicators = [
    'chat about', 'discuss', 'talk about', 'tell me about', 'explain',
    'what is', 'how does', 'why', 'when', 'where', 'who is',
    'can you help me understand', 'i want to learn about',
    'i need information about', 'i have a question about',
    'information about', 'learn about'
  ]
  
  // Check for content generation requests (should trigger edit mode)
  const contentGenerationIndicators = [
    'write', 'create', 'generate', 'compose', 'draft',
    'essay', 'article', 'report', 'document', 'content',
    'table', 'chart', 'grid', 'matrix', 'list', 'schedule'
  ]
  
  const isConversational = chatModeIndicators.some(indicator => lowerMessage.includes(indicator))
  const isContentGeneration = contentGenerationIndicators.some(indicator => lowerMessage.includes(indicator))
  
  // Check for explicit edit mode requests
  const explicitEditIndicators = [
    '/edit', 'edit mode', 'start editing', 'begin editing',
    'modify this', 'change this', 'update this', 'fix this'
  ]
  
  const isExplicitEdit = explicitEditIndicators.some(indicator => lowerMessage.includes(indicator))
  
  // If it's explicitly conversational and not content generation, don't treat as edit request
  if (isConversational && !isExplicitEdit && !isContentGeneration) {
    return null
  }
  
  // Define edit keywords
  const strongEditKeywords = [
    'edit', 'table', 'create table', 'add table', 'insert table', 'make table', 'build table', 'add row', 'add column', 'remove row', 'remove column', 'delete table', 'edit cell', 'improve', 'fix', 'change', 'revise', 'rewrite', 'enhance',
    'grammar', 'clarity', 'tone', 'structure', 'concise', 'expand',
    'tighten', 'professional', 'better', 'polish', 'refine', 'modify',
    'erase', 'clear', 'remove', 'delete', 'correct', 'adjust', 'update',
    'clean up', 'make better', 'improve the', 'fix the', 'change the',
    'replace', 'substitute', 'swap', 'exchange', 'switch',
    'entire content', 'whole content', 'all content', 'full content',
    'into this document', 'to this document', 'in this document',
    'to the document', 'in the document', 'into the document',
    'get rid of', 'rid of', 'eliminate', 'wipe', 'clean out', 'empty'
  ]
  
  const weakEditKeywords = [
    'write', 'add', 'insert', 'create', 'compose', 'draft', 'generate'
  ]
  
  // Check for strong edit indicators
  const hasStrongEditKeywords = strongEditKeywords.some(keyword => lowerMessage.includes(keyword))
  
  // Check for weak edit indicators with document context
  const hasDocumentContext = lowerMessage.includes('document') || lowerMessage.includes('this')
  const hasWeakEditKeywords = weakEditKeywords.some(keyword => lowerMessage.includes(keyword))
  
  // If we have a documentId, we're in a document context even without explicit document references
  const isInDocumentContext = hasDocumentContext || !!documentId
  
  // Determine if this should be treated as an edit request
  let isEditRequest = false
  
  if (isExplicitEdit) {
    // If explicitly requesting edit mode, always proceed
    isEditRequest = true
  } else if (hasStrongEditKeywords) {
    // Strong edit keywords always trigger edit mode
    isEditRequest = true
  } else if (isContentGeneration && isInDocumentContext) {
    // Content generation requests with document context should trigger edit mode
    isEditRequest = true
  } else if (hasWeakEditKeywords && isInDocumentContext && !isConversational) {
    // Weak edit keywords only trigger edit mode if:
    // - They have document context AND
    // - No conversational indicators are present AND
    // - The message contains explicit edit intent (not just content generation)
    const hasExplicitEditIntent = lowerMessage.includes('edit this') || 
                                 lowerMessage.includes('modify this') ||
                                 lowerMessage.includes('change this') ||
                                 lowerMessage.includes('update this') ||
                                 lowerMessage.includes('replace this') ||
                                 lowerMessage.includes('rewrite this') ||
                                 lowerMessage.includes('improve this')
    
    if (hasExplicitEditIntent) {
      isEditRequest = true
    }
  }
  
  if (!isEditRequest) return null
  
  // Extract intent
  let intent = 'improve writing'
  if (lowerMessage.includes('table') && (lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('insert') || lowerMessage.includes('make') || lowerMessage.includes('build'))) {
    intent = 'create table'
  } else if (lowerMessage.includes('add row') || lowerMessage.includes('insert row')) {
    intent = 'add table row'
  } else if (lowerMessage.includes('add column') || lowerMessage.includes('insert column')) {
    intent = 'add table column'
  } else if (lowerMessage.includes('remove row') || lowerMessage.includes('delete row')) {
    intent = 'remove table row'
  } else if (lowerMessage.includes('remove column') || lowerMessage.includes('delete column')) {
    intent = 'remove table column'
  } else if (lowerMessage.includes('delete table') || lowerMessage.includes('remove table')) {
    intent = 'delete table'
  } else if (lowerMessage.includes('edit cell') || lowerMessage.includes('change cell') || lowerMessage.includes('update cell')) {
    intent = 'edit table cell'
  } else if (lowerMessage.includes('table') && (lowerMessage.includes('edit') || lowerMessage.includes('modify') || lowerMessage.includes('update') || lowerMessage.includes('change'))) {
    intent = 'edit table'
  } else if (lowerMessage.includes('get rid of') || lowerMessage.includes('rid of') || lowerMessage.includes('eliminate') || lowerMessage.includes('wipe') || lowerMessage.includes('clean out') || lowerMessage.includes('empty')) {
    intent = 'delete all content'
  } else if (lowerMessage.includes('delete') || lowerMessage.includes('clear') || lowerMessage.includes('remove')) {
    intent = 'delete content'
  } else if (lowerMessage.includes('replace') && (lowerMessage.includes('entire') || lowerMessage.includes('whole') || lowerMessage.includes('all') || lowerMessage.includes('full'))) {
    intent = 'replace entire content'
  } else if (lowerMessage.includes('replace')) {
    intent = 'replace content'
  } else if (lowerMessage.includes('grammar')) intent = 'fix grammar and spelling'
  else if (lowerMessage.includes('clarity')) intent = 'improve clarity'
  else if (lowerMessage.includes('tone')) intent = 'enhance tone'
  else if (lowerMessage.includes('structure')) intent = 'improve structure'
  else if (lowerMessage.includes('concise') || lowerMessage.includes('tighten')) intent = 'make more concise'
  else if (lowerMessage.includes('expand')) intent = 'expand content'
  else if (lowerMessage.includes('professional')) intent = 'make tone professional'
  else if (lowerMessage.includes('polish')) intent = 'polish writing'
  else if (lowerMessage.includes('write') || lowerMessage.includes('compose') || lowerMessage.includes('draft')) intent = 'write new content'
  else if (lowerMessage.includes('add') || lowerMessage.includes('insert')) intent = 'add content'
  else if (lowerMessage.includes('create') || lowerMessage.includes('generate')) intent = 'create content'
  
  // Determine scope
  const scope = lowerMessage.includes('selection') || lowerMessage.includes('selected') 
    ? 'selection' as const 
    : 'document' as const
  
  // Extract guardrails
  const guardrails = {
    allowCodeEdits: !lowerMessage.includes('no code') && !lowerMessage.includes('skip code'),
    allowMathEdits: !lowerMessage.includes('no math') && !lowerMessage.includes('skip math'),
    preserveVoice: !lowerMessage.includes('change voice') && !lowerMessage.includes('different tone')
  }
  
  return { intent, scope, guardrails }
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9)
}
