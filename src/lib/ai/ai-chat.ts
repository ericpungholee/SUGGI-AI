import { generateChatCompletion, ChatMessage } from './openai'
import { getDocumentContext } from './vector-search'
import { prisma } from '@/lib/prisma'
import { evaluateRAGResponse, storeEvaluationMetrics, ragMonitor } from './rag-evaluation'

export interface AIChatRequest {
  message: string
  userId: string
  documentId?: string
  conversationId?: string
  includeContext?: boolean
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

    // Get document context if requested using advanced RAG
    let context = ''
    let contextUsed: string[] = []
    
    if (includeContext) {
      // Check for cancellation before context retrieval
      if (abortSignal?.aborted) {
        return {
          message: 'Operation was cancelled',
          conversationId: conversation.id,
          cancelled: true
        }
      }

      try {
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

    // Build messages for AI
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt(context, documentId)
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

    try {
      response = await generateChatCompletion(messages, {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 1000,
        abortSignal // Pass abort signal to OpenAI
      })

      aiMessage = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.'
      responseTime = Date.now() - startTime
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

    // Evaluate RAG performance
    if (context) {
      try {
        const metrics = await evaluateRAGResponse(
          message,
          context,
          aiMessage,
          responseTime,
          contextUsed.length
        )

        // Store evaluation metrics
        const evaluation = {
          query: message,
          timestamp: new Date(),
          metrics,
          contextChunks: contextUsed.length,
          responseLength: aiMessage.length
        }

        await storeEvaluationMetrics(userId, evaluation)
        ragMonitor.addEvaluation(evaluation)

        console.log('RAG Evaluation:', {
          query: message,
          overallScore: metrics.overallScore,
          responseTime: metrics.responseTime
        })
      } catch (error) {
        console.error('Error evaluating RAG response:', error)
      }
    }

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
      } : undefined
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
 * Build system prompt with context
 */
function buildSystemPrompt(context: string, documentId?: string): string {
  let prompt = `You are an advanced AI writing assistant. You excel at understanding context, providing accurate information, and helping with complex writing tasks.

Your capabilities:
- Analyze and understand document content with high accuracy
- Answer questions based on retrieved context with citations
- Help improve writing quality, grammar, and style
- Generate content that's contextually relevant and well-structured
- Provide research assistance with proper source attribution
- Suggest improvements and alternatives with clear reasoning

Guidelines for accuracy:
- When document context is provided, base your responses on it and cite sources
- When no context is available, provide general assistance based on your training knowledge
- Be clear about the limitations of your knowledge when context is not available
- Provide specific, actionable suggestions with clear explanations
- Maintain a professional but approachable tone
- Be precise and avoid making assumptions not supported by the context
- When suggesting changes, explain your reasoning`

  if (context) {
    prompt += `\n\n=== RELEVANT DOCUMENT CONTEXT ===\n${context}\n\nUse this context to provide accurate, well-informed responses. Always cite which document and section you're referencing.`
  } else {
    prompt += `\n\nNo specific document context was retrieved for this query. You can still provide helpful assistance based on your general knowledge, but be clear that you don't have access to specific document content.`
  }

  if (documentId) {
    prompt += `\n\nNote: You are currently helping with document ID: ${documentId}. If you cannot access the specific content of this document, explain that the document content is not currently available in your context.`
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
 * Generate unique ID
 */
function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9)
}
