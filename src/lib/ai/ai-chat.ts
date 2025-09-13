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

    // Detect if this is an edit request
    const editDetection = detectEditRequest(message)
    console.log('Edit detection result:', editDetection)
    console.log('Message being analyzed:', message)

    // If this is an edit request, return immediately with edit suggestion
    if (editDetection.shouldProposeEdit) {
      return {
        message: '',
        conversationId: conversationId || '',
        editSuggestion: {
          intent: editDetection.intent,
          shouldProposeEdit: true,
          originalMessage: message // Pass the original message for context
        }
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
        content: buildSystemPrompt(context, documentId, contextSource, isGeneralQuery, editDetection.shouldProposeEdit)
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
      // Define tools available to the AI
      const tools = documentId ? [
        {
          type: 'function' as const,
          function: {
            name: 'propose_edit',
            description: 'Propose a non-committal edit for the document or selection; returns a patch for preview.',
            parameters: {
              type: 'object',
              properties: {
                docId: { type: 'string', description: 'Current document id' },
                scope: { type: 'string', enum: ['selection', 'document'], description: 'Whether to edit selection or entire document' },
                selection: {
                  type: 'object',
                  properties: { 
                    from: { type: 'number' }, 
                    to: { type: 'number' } 
                  },
                  required: ['from', 'to']
                },
                intent: { type: 'string', description: 'User intent, e.g., "tighten intro, professional tone"' }
              },
              required: ['docId', 'scope', 'intent']
            }
          }
        }
      ] : undefined;

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
      editSuggestion: editDetection.shouldProposeEdit ? {
        intent: editDetection.intent,
        shouldProposeEdit: true
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

IMPORTANT - Document Editing Integration:
- When users ask for document editing, writing, or content creation, IMMEDIATELY call the propose_edit tool
- This includes: "write an essay", "improve this", "add content", "fix grammar", "rewrite", etc.
- DO NOT write any content in your response - ONLY call the propose_edit tool
- DO NOT say "I'll write" or "I'll create" - just call the tool directly
- Keep your response to 1 sentence maximum, then call propose_edit
- Example: "Creating essay about Y Combinator." then call propose_edit tool
- The system will handle showing the preview and applying changes
- CRITICAL: Never provide content in chat - always use propose_edit tool`

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
 * Detect if a message is requesting document editing
 */
function detectEditRequest(message: string): { intent: string; shouldProposeEdit: boolean } {
  const messageLower = message.toLowerCase().trim()
  console.log('Analyzing message for edit detection:', messageLower)
  
  // Writing and editing request patterns
  const editPatterns = [
    // Writing requests
    { pattern: /write\s+(a|an|the)?\s*(essay|article|story|report|summary|content|text|document)/i, intent: 'write content' },
    { pattern: /create\s+(a|an|the)?\s*(essay|article|story|report|summary|content|text|document)/i, intent: 'write content' },
    { pattern: /add\s+(a|an|the)?\s*(essay|article|story|report|summary|content|text|section)/i, intent: 'write content' },
    { pattern: /generate\s+(a|an|the)?\s*(essay|article|story|report|summary|content|text)/i, intent: 'write content' },
    
    // Editing requests
    { pattern: /(improve|enhance|better|polish|refine)\s+(writing|text|content|document|this)/i, intent: 'improve writing' },
    { pattern: /(fix|correct|check)\s+(grammar|spelling|errors?|typos?)/i, intent: 'fix grammar' },
    { pattern: /(make|make it)\s+(more\s+)?(concise|shorter|brief)/i, intent: 'make concise' },
    { pattern: /(simplify|make\s+simpler|easier\s+to\s+read)/i, intent: 'simplify' },
    { pattern: /(improve|enhance|better)\s+(tone|voice|style)/i, intent: 'enhance tone' },
    { pattern: /(restructure|reorganize|improve\s+structure|better\s+structure)/i, intent: 'improve structure' },
    { pattern: /(rewrite|rewrite\s+this|rephrase)/i, intent: 'rewrite' },
    { pattern: /(edit|edit\s+this|modify|change)/i, intent: 'edit' },
    { pattern: /(can you\s+)?(improve|fix|enhance|better)\s+(this|it|the\s+text|the\s+content)/i, intent: 'improve writing' }
  ]

  console.log('Testing patterns...')
  for (const { pattern, intent } of editPatterns) {
    console.log('Testing pattern:', pattern, 'against:', messageLower)
    if (pattern.test(messageLower)) {
      console.log('Pattern matched! Intent:', intent)
      return { intent, shouldProposeEdit: true }
    }
  }

  // General writing and editing keywords
  const editKeywords = [
    'write', 'create', 'add', 'generate', 'compose', 'draft',
    'improve', 'fix', 'enhance', 'better', 'polish', 'refine', 'rewrite',
    'edit', 'modify', 'change', 'correct', 'check', 'grammar', 'spelling',
    'concise', 'simpler', 'structure', 'tone', 'style', 'voice'
  ]

  console.log('Testing keywords...')
  const hasEditKeywords = editKeywords.some(keyword => {
    const hasKeyword = messageLower.includes(keyword)
    console.log('Keyword:', keyword, 'Found:', hasKeyword)
    return hasKeyword
  })
  
  if (hasEditKeywords) {
    console.log('Keyword match found!')
    return { intent: 'improve writing', shouldProposeEdit: true }
  }

  console.log('No edit request detected')
  return { intent: '', shouldProposeEdit: false }
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9)
}
