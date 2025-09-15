import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages'

export interface ConversationContext {
  conversationId: string
  documentId: string
  userId: string
  messages: BaseMessage[]
  editHistory: EditHistoryEntry[]
  lastEditRequest?: string
  documentVersion: number
}

export interface EditHistoryEntry {
  id: string
  timestamp: Date
  userIntent: string
  editType: 'grammar' | 'clarity' | 'tone' | 'structure' | 'content'
  changesApplied: number
  success: boolean
  userFeedback?: 'positive' | 'negative' | 'neutral'
}

// GET - Get conversation context
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const documentId = searchParams.get('documentId')
    const userId = searchParams.get('userId')

    if (!conversationId || !documentId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Load conversation messages
    const conversation = await prisma.aIConversation.findUnique({
      where: { id: conversationId }
    })
    
    const messages: BaseMessage[] = []
    if (conversation && conversation.messages) {
      const messageArray = Array.isArray(conversation.messages) ? conversation.messages : []
      messages.push(...messageArray.map((msg: any) => {
        if (msg.type === 'user') {
          return new HumanMessage(msg.content)
        } else {
          return new AIMessage(msg.content)
        }
      }))
    }
    
    // Load edit history (this would come from edit proposals table)
    const editHistory: EditHistoryEntry[] = []
    
    const context: ConversationContext = {
      conversationId,
      documentId,
      userId,
      messages,
      editHistory,
      documentVersion: 0
    }

    return NextResponse.json({ context })
  } catch (error) {
    console.error('Error loading conversation context:', error)
    return NextResponse.json(
      { error: 'Failed to load conversation context' },
      { status: 500 }
    )
  }
}

// POST - Update conversation context
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, documentId, userId, newMessage, editHistoryEntry } = body

    if (!conversationId || !documentId || !userId || !newMessage) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Get current conversation
    let conversation = await prisma.aIConversation.findUnique({
      where: { id: conversationId }
    })

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.aIConversation.create({
        data: {
          id: conversationId,
          documentId,
          userId,
          messages: [newMessage]
        }
      })
    } else {
      // Update existing conversation
      const currentMessages = Array.isArray(conversation.messages) ? conversation.messages : []
      const updatedMessages = [...currentMessages, newMessage]
      
      // Keep only recent messages (last 20)
      const recentMessages = updatedMessages.slice(-20)
      
      conversation = await prisma.aIConversation.update({
        where: { id: conversationId },
        data: {
          messages: recentMessages,
          updatedAt: new Date()
        }
      })
    }

    // Save edit history entry if provided
    if (editHistoryEntry) {
      // This would save to edit proposals table
      console.log('Saving edit history entry:', editHistoryEntry)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating conversation context:', error)
    return NextResponse.json(
      { error: 'Failed to update conversation context' },
      { status: 500 }
    )
  }
}

// GET - Get relevant context for AI processing
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, documentId, userId, currentMessage } = body

    if (!conversationId || !documentId || !userId || !currentMessage) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Get conversation context
    const conversation = await prisma.aIConversation.findUnique({
      where: { id: conversationId }
    })
    
    const messages: BaseMessage[] = []
    if (conversation && conversation.messages) {
      const messageArray = Array.isArray(conversation.messages) ? conversation.messages : []
      messages.push(...messageArray.map((msg: any) => {
        if (msg.type === 'user') {
          return new HumanMessage(msg.content)
        } else {
          return new AIMessage(msg.content)
        }
      }))
    }
    
    // Get recent messages (last 5)
    const recentMessages = messages.slice(-5)
    
    // Get document context
    const document = await prisma.document.findUnique({
      where: { id: documentId, userId }
    })
    
    const documentContext = document?.plainText || document?.content || ''
    
    // Analyze edit patterns and user preferences
    const editHistory: EditHistoryEntry[] = [] // This would come from edit proposals table
    const editPatterns = analyzeEditPatterns(editHistory)
    const userPreferences = analyzeUserPreferences(editHistory, messages)
    
    return NextResponse.json({
      recentMessages,
      editPatterns,
      documentContext,
      userPreferences
    })
  } catch (error) {
    console.error('Error getting relevant context:', error)
    return NextResponse.json(
      { error: 'Failed to get relevant context' },
      { status: 500 }
    )
  }
}

function analyzeEditPatterns(editHistory: EditHistoryEntry[]): string[] {
  const patterns: string[] = []
  
  // Analyze common edit types
  const editTypes = editHistory.map(entry => entry.editType)
  const typeCounts = editTypes.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  // Find most common edit types
  const sortedTypes = Object.entries(typeCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([type]) => type)
  
  patterns.push(...sortedTypes)
  
  // Analyze success patterns
  const successRate = editHistory.filter(entry => entry.success).length / editHistory.length
  if (successRate > 0.8) {
    patterns.push('high_success_rate')
  } else if (successRate < 0.5) {
    patterns.push('low_success_rate')
  }
  
  return patterns
}

function analyzeUserPreferences(
  editHistory: EditHistoryEntry[],
  messages: BaseMessage[]
): {
  preferredEditStyle: string
  commonIntents: string[]
  guardrails: Record<string, boolean>
} {
  // Analyze common intents from edit history
  const intents = editHistory.map(entry => entry.userIntent.toLowerCase())
  const intentCounts = intents.reduce((acc, intent) => {
    acc[intent] = (acc[intent] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const commonIntents = Object.entries(intentCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([intent]) => intent)
  
  // Determine preferred edit style based on history
  let preferredEditStyle = 'surgical'
  if (editHistory.some(entry => entry.editType === 'content' && entry.changesApplied > 10)) {
    preferredEditStyle = 'comprehensive'
  } else if (editHistory.some(entry => entry.editType === 'grammar' && entry.changesApplied < 3)) {
    preferredEditStyle = 'minimal'
  }
  
  // Analyze guardrails from messages
  const guardrails: Record<string, boolean> = {
    preserveVoice: true,
    allowCodeEdits: true,
    allowMathEdits: true
  }
  
  return {
    preferredEditStyle,
    commonIntents,
    guardrails
  }
}
