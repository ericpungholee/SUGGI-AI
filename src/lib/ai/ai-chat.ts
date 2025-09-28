import { generateChatCompletion, ChatMessage } from './openai'
import { getDocumentContext } from './vector-search'
import { searchWeb, formatSearchResultsForAI } from './web-search'
import { analyzeDocumentContext } from './document-analyzer'
// import { prisma } from '@/lib/prisma'

/**
 * Check if a query is simple enough to not require RAG
 */
function isSimpleQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim()
  
  // Very short queries
  if (lowerMessage.length < 10) return true
  
  // Simple greetings or acknowledgments
  const simplePatterns = [
    /^(hi|hello|hey|thanks?|thank you|ok|okay|yes|no|sure|alright)$/,
    /^(good|great|nice|cool|awesome|perfect|excellent)$/,
    /^(what|how|why|when|where|who)\s+\w+\?$/, // Simple questions
    /^(can you|could you|please)\s+\w+/, // Simple requests
    /^(add|remove|delete|clear)\s+\w+/, // Simple commands
  ]
  
  return simplePatterns.some(pattern => pattern.test(lowerMessage))
}

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
  editRequest?: any
  cancelled?: boolean
  error?: boolean
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  tokenUsage?: any
}

/**
 * Process AI chat request with document context
 */
export async function processAIChat(request: AIChatRequest): Promise<AIChatResponse> {
  const startTime = Date.now()
  const performanceMetrics = {
    contextTime: 0,
    webSearchTime: 0,
    totalTime: 0,
    operationsSkipped: [] as string[]
  }
  
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

    // Simple edit request detection (fallback)
    const editRequest = detectEditRequest(message, documentId)
    if (editRequest && documentId) {
      console.log('Edit request detected:', { 
        message, 
        editRequest, 
        documentId
      })
      
      return {
        message: 'I\'ll help you edit your document. Let me analyze the content and make the changes you need.',
        conversationId: conversationId || '',
        editRequest
      }
    }

    // Determine if we need context
    let context = ''
    let contextSource = 'none'
    let contextUsed: string[] = []
    
    if (includeContext) {
      const contextStart = Date.now()
      
      try {
        // Get document context if we have a document
        if (documentId) {
          const documentContext = await getDocumentContext(message, documentId, userId, 5)
          
          if (Array.isArray(documentContext) && documentContext.length > 0) {
            context = documentContext.map((ctx: any) => ctx.content).join('\n\n')
            contextSource = 'document'
            contextUsed = documentContext.map((ctx: any) => ctx.metadata?.title || 'Document').filter(Boolean)
            console.log('Document context retrieved:', {
              chunks: documentContext.length,
              contextLength: context.length,
              sources: contextUsed
            })
          }
        }
        
        // Get connected document context if available
        if (connectedDocumentIds.length > 0) {
          const connectedContexts = await Promise.all(
            connectedDocumentIds.map(async (id) => {
              try {
                return await getDocumentContext(message, id, userId, 3)
              } catch (error) {
                console.warn(`Failed to get context from connected document ${id}:`, error)
                return []
              }
            })
          )
          
          const allConnectedContext = connectedContexts.flat()
          if (Array.isArray(allConnectedContext) && allConnectedContext.length > 0) {
            const connectedText = allConnectedContext.map((ctx: any) => ctx.content).join('\n\n')
            context += '\n\n--- Connected Documents ---\n\n' + connectedText
            contextSource = 'documents'
            contextUsed.push(...allConnectedContext.map((ctx: any) => ctx.metadata?.title || 'Connected Document').filter(Boolean))
            console.log('Connected document context retrieved:', {
              documents: connectedDocumentIds.length,
              chunks: allConnectedContext.length,
              contextLength: connectedText.length
            })
          }
        }
        
        performanceMetrics.contextTime = Date.now() - contextStart
      } catch (error) {
        console.warn('Failed to retrieve context:', error)
        performanceMetrics.operationsSkipped.push('context_retrieval')
      }
    }

    // Handle web search if requested
    let webSearchResults = ''
    if (useWebSearch) {
      const webSearchStart = Date.now()
      try {
        const searchQuery = extractSearchQuery(message)
        if (searchQuery && searchQuery.length > 2) {
          const searchResults = await searchWeb(searchQuery)
          webSearchResults = formatSearchResultsForAI(searchResults)
          console.log('Web search completed:', {
            query: searchQuery,
            resultsCount: searchResults.length,
            resultsLength: webSearchResults.length
          })
        } else {
          console.log('No valid search query extracted, skipping web search')
        }
        performanceMetrics.webSearchTime = Date.now() - webSearchStart
      } catch (error) {
        console.warn('Web search failed:', error)
        performanceMetrics.operationsSkipped.push('web_search')
      }
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      context, 
      documentId, 
      connectedDocumentIds, 
      contextSource, 
      false, // isGeneralQuery
      false  // isEditRequest
    )

    // Add web search results to context if available
    const fullContext = webSearchResults ? `${context}\n\n--- Web Search Results ---\n\n${webSearchResults}` : context

    // Generate response
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversation.messages.slice(-10), // Last 10 messages for context
      { role: 'user', content: message }
    ]

    const response = await generateChatCompletion(messages, {
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 2000
    })

    const choice = response.choices[0]
    if (!choice?.message?.content) {
      throw new Error('No response generated')
    }

    const aiMessage = choice.message.content

    // Save conversation
    const updatedMessages: ConversationMessage[] = [
      ...conversation.messages,
      { role: 'user' as const, content: message, timestamp: new Date() },
      { role: 'assistant' as const, content: aiMessage, timestamp: new Date() }
    ]

    await saveMessages(conversation.id, updatedMessages)

    performanceMetrics.totalTime = Date.now() - startTime

    console.log('AI Chat completed:', {
      message: message.substring(0, 100) + '...',
      responseLength: aiMessage.length,
      contextUsed,
      performanceMetrics,
      documentId
    })

    return {
      message: aiMessage,
      conversationId: conversation.id,
      contextUsed,
      tokenUsage: response.usage ? {
        prompt: response.usage.prompt_tokens || 0,
        completion: response.usage.completion_tokens || 0,
        total: response.usage.total_tokens || 0
      } : undefined
    }

  } catch (error) {
    console.error('AI Chat error:', error)
    
    // Return error response
    return {
      message: 'I apologize, but I encountered an error processing your request. Please try again.',
      conversationId: request.conversationId || '',
      error: true
    }
  }
}

/**
 * Simple edit request detection (fallback)
 */
function detectEditRequest(message: string, documentId?: string): any | null {
  if (!documentId) return null
  
  const lowerMessage = message.toLowerCase()
  
  // Check for edit-related keywords
  const editKeywords = [
    'edit', 'change', 'modify', 'update', 'rewrite', 'improve', 'fix',
    'add', 'insert', 'remove', 'delete', 'replace', 'create', 'write',
    'format', 'organize', 'structure', 'reorganize', 'restructure'
  ]
  
  const hasEditKeyword = editKeywords.some(keyword => lowerMessage.includes(keyword))
  
  if (hasEditKeyword) {
    return {
      intent: 'edit',
      scope: 'document',
      guardrails: {
        allowCodeEdits: true,
        allowMathEdits: true,
        preserveVoice: true
      }
    }
  }
  
  return null
}

/**
 * Extract search query from message
 */
function extractSearchQuery(message: string): string {
  // Simple extraction - look for search-related phrases
  const searchPatterns = [
    /search for (.+)/i,
    /look up (.+)/i,
    /find (.+)/i,
    /get (.+)/i,
    /what is (.+)/i,
    /what are (.+)/i,
    /how does (.+)/i,
    /when did (.+)/i,
    /where is (.+)/i,
    /who is (.+)/i
  ]
  
  for (const pattern of searchPatterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  // If no pattern matches, return the message itself
  return message
}

/**
 * Get or create conversation
 */
async function getConversation(conversationId: string, userId: string): Promise<{ id: string; messages: ConversationMessage[] }> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const conversation = await prisma.aIConversation.findFirst({
      where: { 
        id: conversationId, 
        userId 
      }
    })

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    // Parse messages from JSON
    const messages = Array.isArray(conversation.messages) 
      ? conversation.messages as ConversationMessage[]
      : []

    return {
      id: conversation.id,
      messages
    }
  } catch (error) {
    console.error('Error getting conversation:', error)
    throw error
  }
}

/**
 * Create new conversation
 */
async function createConversation(userId: string, documentId?: string): Promise<{ id: string; messages: ConversationMessage[] }> {
  try {
    const { prisma } = await import('@/lib/prisma')
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
  } catch (error) {
    console.error('Error creating conversation:', error)
    throw error
  }
}

/**
 * Save messages to conversation
 */
async function saveMessages(conversationId: string, messages: ConversationMessage[]) {
  try {
    const { prisma } = await import('@/lib/prisma')
    // Update the conversation with new messages
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: { 
        messages: messages,
        updatedAt: new Date()
      }
    })
  } catch (error) {
    console.error('Error saving messages:', error)
  }
}

/**
 * Get conversation history
 */
export async function getConversationHistory(conversationId: string, userId: string, limit?: number): Promise<ConversationMessage[]> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const conversation = await prisma.aIConversation.findFirst({
      where: { 
        id: conversationId, 
        userId 
      }
    })

    if (!conversation) {
      return []
    }

    // Parse messages from JSON
    return Array.isArray(conversation.messages) 
      ? conversation.messages as ConversationMessage[]
      : []
  } catch (error) {
    console.error('Error getting conversation history:', error)
    return []
  }
}

/**
 * Get user conversations
 */
export async function getUserConversations(userId: string, limit: number = 50): Promise<Array<{id: string, title: string, createdAt: Date, messageCount: number}>> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const conversations = await prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit
    })

    return conversations.map(conv => ({
      id: conv.id,
      title: 'AI Conversation', // AIConversation doesn't have title field
      createdAt: conv.createdAt,
      messageCount: Array.isArray(conv.messages) ? conv.messages.length : 0
    }))
  } catch (error) {
    console.error('Error getting user conversations:', error)
    return []
  }
}

/**
 * Delete conversation
 */
export async function deleteConversation(conversationId: string, userId: string): Promise<boolean> {
  try {
    const { prisma } = await import('@/lib/prisma')
    // First verify the conversation belongs to the user
    const conversation = await prisma.aIConversation.findFirst({
      where: { 
        id: conversationId, 
        userId 
      }
    })

    if (!conversation) {
      return false
    }

    // Delete the conversation
    await prisma.aIConversation.delete({
      where: { id: conversationId }
    })

    return true
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return false
  }
}

/**
 * Build system prompt based on context and settings
 */
function buildSystemPrompt(context: string, documentId?: string, connectedDocumentIds: string[] = [], contextSource: string = 'document', isGeneralQuery: boolean = false, isEditRequest: boolean = false): string {
  let prompt = `You are an AI writing assistant specialized in helping users with document editing, content creation, and analysis. You have access to document context and can help with various writing tasks.

CORE CAPABILITIES:
- Document editing and content modification
- Content generation and creation
- Text analysis and summarization
- Table creation and editing
- Formatting and structure improvements
- Research and fact-checking assistance
- Writing style and tone adjustments

IMPORTANT GUIDELINES:
1. Always be helpful, accurate, and professional
2. When editing documents, maintain the user's voice and style
3. Provide specific, actionable suggestions
4. Ask clarifying questions when needed
5. Cite sources when using external information
6. Respect document structure and formatting preferences

`

  if (context && contextSource !== 'none') {
    prompt += `DOCUMENT CONTEXT (${contextSource}):
${context}

Use this context to provide relevant, informed responses. Reference specific parts of the document when appropriate.

`
  }

  if (documentId) {
    prompt += `CURRENT DOCUMENT: You are working with a specific document. Focus your responses on content that would be relevant to this document.

`
  }

  if (connectedDocumentIds.length > 0) {
    prompt += `CONNECTED DOCUMENTS: You also have access to related documents that may provide additional context.

`
  }

  if (isEditRequest) {
    prompt += `EDIT MODE: The user is requesting document edits. Provide specific, actionable editing suggestions and be prepared to generate or modify content.

`
  }

  prompt += `RESPONSE FORMAT:
- Be concise but comprehensive
- Use clear, professional language
- Provide examples when helpful
- Structure your response logically
- End with a clear call to action if appropriate

Remember: You are here to help the user improve their writing and documents. Be supportive, constructive, and always aim to add value.`

  return prompt
}
