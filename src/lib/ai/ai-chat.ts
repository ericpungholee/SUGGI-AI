import { generateChatCompletion, ChatMessage } from './openai'
import { getDocumentContext } from './vector-search'
import { searchWeb, formatSearchResultsForAI } from './web-search'
import { prisma } from '@/lib/prisma'

export interface AIChatRequest {
  message: string
  userId: string
  documentId?: string
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

    // Check if this is an editing request
    const editRequest = detectEditRequest(message)
    console.log('Edit detection in chat:', { message, editRequest, documentId })
    if (editRequest && documentId) {
      console.log('Edit request detected, returning early with editRequest')
      return {
        message: 'I\'ll help you edit your document. Let me analyze the content and propose improvements.',
        conversationId: conversationId || '',
        editRequest
      }
    }


    // Get or create conversation
    let conversation = conversationId 
      ? await getConversation(conversationId, userId)
      : await createConversation(userId, documentId)

    // Get document context if requested using advanced RAG
    let context = ''
    let contextUsed: string[] = []
    let contextSource = 'document'
    
    // Check if this is a general knowledge query first
    const isGeneralQuery = isGeneralKnowledgeQuery(message)
    const isFollowUp = isFollowUpQuery(message)
    
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
        
        context = await getDocumentContext(message, userId, documentId, 8) // Increased context chunks
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
        content: buildSystemPrompt(context, documentId, contextSource, isGeneralQuery, false)
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

/**
 * Check if a query appears to be a general knowledge question
 */
function isGeneralKnowledgeQuery(message: string): boolean {
  const messageLower = message.toLowerCase().trim()
  
  // First check for document-specific indicators that should NOT be treated as general knowledge
  const documentSpecificPatterns = [
    /from this document/i,
    /in this document/i,
    /in the document/i,
    /from the document/i,
    /current document/i,
    /this document/i,
    /the document/i,
    /in this file/i,
    /from this file/i,
    /in this text/i,
    /from this text/i,
    /what was that/i,
    /what did it say/i,
    /what does it say/i,
    /what does the document say/i,
    /what does this say/i,
    /what does that say/i,
    /according to this/i,
    /based on this/i,
    /from the text/i,
    /in the text/i,
    // Financial data queries that are likely document-specific
    /what was.*yoy/i,
    /what was.*revenue/i,
    /what was.*income/i,
    /what was.*profit/i,
    /what was.*growth/i,
    /what was.*quarter/i,
    /what was.*q[1-4]/i,
    /what was.*date/i,
    /what was.*year/i,
    /what was.*period/i
  ]
  
  // If it contains document-specific indicators, it's NOT a general knowledge query
  for (const pattern of documentSpecificPatterns) {
    if (pattern.test(messageLower)) {
      return false
    }
  }
  
  const generalKnowledgePatterns = [
    /^who is/i,
    /^what is/i,
    /^when did/i,
    /^where is/i,
    /^how does/i,
    /^why did/i,
    /^tell me about/i,
    /^explain/i,
    /^define/i,
    /^describe/i,
    /^what are/i,
    /^who are/i,
    /^when was/i,
    /^where are/i,
    /^how are/i,
    /^why are/i,
    /^can you tell me/i,
    /^do you know/i,
    /^what do you know about/i,
    /^who was/i,
    /^what was/i,
    /^when was/i,
    /^where was/i,
    /^how was/i,
    /^why was/i
  ]
  
  // Check for general knowledge patterns
  for (const pattern of generalKnowledgePatterns) {
    if (pattern.test(messageLower)) {
      return true
    }
  }

  // Check for specific entity types that are likely general knowledge
  const entityPatterns = [
    /\b(celebrity|person|politician|actor|musician|scientist|inventor|author|artist)\b/i,
    /\b(company|corporation|organization|brand|product)\b/i,
    /\b(place|city|country|state|continent|landmark)\b/i,
    /\b(event|war|battle|discovery|invention|movement)\b/i,
    /\b(concept|theory|principle|law|rule|method)\b/i,
    /\b(technology|software|platform|service|tool)\b/i
  ]

  for (const pattern of entityPatterns) {
    if (pattern.test(messageLower)) {
      return true
    }
  }

  return false
}

/**
 * Check if a query is a simple follow-up (like "tell me more", "what about them")
 */
function isFollowUpQuery(message: string): boolean {
  const followUpKeywords = [
    'tell me more', 'more info', 'more information', 'more details',
    'what about', 'what else', 'anything else', 'can you provide more',
    'give me more', 'show me more', 'elaborate', 'expand on',
    'them', 'it', 'this', 'that', 'these', 'those'
  ]
  
  const lowerQuery = message.toLowerCase().trim()
  return followUpKeywords.some(keyword => lowerQuery.includes(keyword)) || 
         lowerQuery.length < 20 // Very short queries are likely follow-ups
}

/**
 * Build system prompt with context
 */
function buildSystemPrompt(context: string, documentId?: string, contextSource: string = 'document', isGeneralQuery: boolean = false, isEditRequest: boolean = false): string {
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

  if (documentId) {
    prompt += `\n\nNote: You are currently helping with document ID: ${documentId}. If you cannot access the specific content of this document in the context above, explain that the document content is not currently available and suggest that the user may need to re-vectorize the document.`
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
function detectEditRequest(message: string): {
  intent: string
  scope: 'selection' | 'document'
  guardrails: {
    allowCodeEdits: boolean
    allowMathEdits: boolean
    preserveVoice: boolean
  }
} | null {
  const lowerMessage = message.toLowerCase()
  
  const editingKeywords = [
    'edit', 'improve', 'fix', 'change', 'revise', 'rewrite', 'enhance',
    'grammar', 'clarity', 'tone', 'structure', 'concise', 'expand',
    'tighten', 'professional', 'better', 'polish', 'refine', 'modify',
    'erase', 'clear', 'remove', 'delete', 'correct', 'adjust', 'update',
    'clean up', 'make better', 'improve the', 'fix the', 'change the',
    'write', 'add', 'insert', 'create', 'compose', 'draft', 'generate',
    'into this document', 'to this document', 'in this document',
    'to the document', 'in the document', 'into the document'
  ]
  
  const isEditRequest = editingKeywords.some(keyword => lowerMessage.includes(keyword))
  
  if (!isEditRequest) return null
  
  // Extract intent
  let intent = 'improve writing'
  if (lowerMessage.includes('grammar')) intent = 'fix grammar and spelling'
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
