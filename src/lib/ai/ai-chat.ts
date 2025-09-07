import { generateChatCompletion, ChatMessage } from './openai'
import { getDocumentContext } from './vector-search'
import { prisma } from '@/lib/prisma'

export interface AIChatRequest {
  message: string
  userId: string
  documentId?: string
  conversationId?: string
  includeContext?: boolean
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
      includeContext = true
    } = request

    // Get or create conversation
    let conversation = conversationId 
      ? await getConversation(conversationId, userId)
      : await createConversation(userId, documentId)

    // Get document context if requested
    let context = ''
    let contextUsed: string[] = []
    
    if (includeContext) {
      context = await getDocumentContext(message, userId, documentId)
      if (context) {
        contextUsed = [context]
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

    // Generate AI response
    const response = await generateChatCompletion(messages, {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_completion_tokens: 1000
    })

    const aiMessage = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.'

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
  let prompt = `You are an AI writing assistant integrated into a document editor. You help users with writing, editing, research, and content generation.

Your capabilities:
- Help improve writing quality, grammar, and style
- Generate content based on user requests
- Answer questions about documents
- Provide research assistance
- Suggest improvements and alternatives

Guidelines:
- Be helpful, accurate, and concise
- Provide specific, actionable suggestions
- Maintain a professional but friendly tone
- When suggesting changes, explain your reasoning
- If you reference specific content, be clear about what you're referring to`

  if (context) {
    prompt += `\n\nRelevant document context:\n${context}`
  }

  if (documentId) {
    prompt += `\n\nYou are currently helping with document ID: ${documentId}`
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
