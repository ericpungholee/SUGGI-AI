import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/ai/chat-history?documentId=xxx - Get chat history for a document
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    // Get or create conversation for this document
    let conversation = await prisma.aIConversation.findFirst({
      where: {
        userId: session.user.id,
        documentId: documentId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // If no conversation exists, create one
    if (!conversation) {
      conversation = await prisma.aIConversation.create({
        data: {
          userId: session.user.id,
          documentId: documentId,
          messages: []
        }
      })
    }

    return NextResponse.json({
      conversationId: conversation.id,
      messages: conversation.messages || []
    })

  } catch (error) {
    console.error('Error fetching chat history:', error)
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 })
  }
}

// POST /api/ai/chat-history - Save messages to chat history
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId, messages } = await request.json()

    if (!documentId || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Document ID and messages array are required' }, { status: 400 })
    }

    // Get or create conversation for this document
    let conversation = await prisma.aIConversation.findFirst({
      where: {
        userId: session.user.id,
        documentId: documentId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    if (!conversation) {
      conversation = await prisma.aIConversation.create({
        data: {
          userId: session.user.id,
          documentId: documentId,
          messages: messages
        }
      })
    } else {
      // Update existing conversation
      conversation = await prisma.aIConversation.update({
        where: { id: conversation.id },
        data: {
          messages: messages,
          updatedAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      conversationId: conversation.id
    })

  } catch (error) {
    console.error('Error saving chat history:', error)
    return NextResponse.json({ error: 'Failed to save chat history' }, { status: 500 })
  }
}
