import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    console.log('📚 GET /api/conversations - Starting request')
    
    const session = await getServerSession(authOptions)
    console.log('📚 Session status:', { hasSession: !!session, userId: session?.user?.id })
    
    if (!session?.user?.id) {
      console.log('📚 No session found, returning 401')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')
    console.log('📚 Document ID from params:', documentId)

    if (!documentId) {
      console.log('📚 No document ID provided, returning 400')
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    console.log('📚 Loading conversation history:', {
      userId: session.user.id,
      documentId
    })

    // Test database connection first
    try {
      await prisma.$connect()
      console.log('📚 Database connected successfully')
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError)
      throw new Error(`Database connection failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
    }

    // Find the most recent conversation for this document and user
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        userId: session.user.id,
        documentId: documentId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    if (!conversation) {
      console.log('📚 No conversation found for document')
      return NextResponse.json({
        conversationId: null,
        messages: []
      })
    }

    console.log('📚 Found conversation:', {
      conversationId: conversation.id,
      messageCount: Array.isArray(conversation.messages) ? conversation.messages.length : 0,
      lastUpdated: conversation.updatedAt
    })

    return NextResponse.json({
      conversationId: conversation.id,
      messages: conversation.messages || []
    })

  } catch (error) {
    console.error('❌ Error loading conversation history:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to load conversation history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { documentId, messages } = body

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages must be an array' },
        { status: 400 }
      )
    }

    console.log('💾 Saving conversation history:', {
      userId: session.user.id,
      documentId,
      messageCount: messages.length
    })

    // Find existing conversation or create new one
    let conversation = await prisma.aIConversation.findFirst({
      where: {
        userId: session.user.id,
        documentId: documentId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    if (conversation) {
      // Update existing conversation
      conversation = await prisma.aIConversation.update({
        where: { id: conversation.id },
        data: {
          messages: messages,
          updatedAt: new Date()
        }
      })
    } else {
      // Create new conversation
      conversation = await prisma.aIConversation.create({
        data: {
          userId: session.user.id,
          documentId: documentId,
          messages: messages
        }
      })
    }

    console.log('✅ Conversation saved:', {
      conversationId: conversation.id,
      messageCount: messages.length
    })

    return NextResponse.json({
      conversationId: conversation.id,
      success: true
    })

  } catch (error) {
    console.error('❌ Error saving conversation history:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to save conversation history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    console.log('🗑️ Deleting conversation history:', {
      userId: session.user.id,
      documentId
    })

    // Delete all conversations for this document and user
    const result = await prisma.aIConversation.deleteMany({
      where: {
        userId: session.user.id,
        documentId: documentId
      }
    })

    console.log('✅ Conversation history deleted:', {
      deletedCount: result.count
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.count
    })

  } catch (error) {
    console.error('❌ Error deleting conversation history:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to delete conversation history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}