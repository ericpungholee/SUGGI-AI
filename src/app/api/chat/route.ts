import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { classifyWritingIntent, ClassificationContext } from '@/lib/ai/writing-intent-classifier'
import { routeByIntent, HandlerContext } from '@/lib/ai/intent-handlers'

/**
 * AI Chat API Route
 * Implements intent-based routing for writing workspace
 */
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
    const { 
      message, 
      documentId, 
      selection,
      documentContent,
      cursorPosition,
      conversationHistory = [],
      forceWebSearch = false
    } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    console.log('💬 Chat Request:', {
      userId: session.user.id,
      documentId,
      messageLength: message.length,
      conversationLength: conversationHistory.length,
      hasDocumentContent: !!documentContent,
      hasSelection: !!selection,
      forceWebSearch
    })

    // Step 1: Classify intent
    const classificationContext: ClassificationContext = {
      hasDocumentId: !!documentId,
      hasSelection: !!selection && selection.length > 0,
      selectionLength: selection?.length || 0,
      hasDocumentContent: !!documentContent,
      conversationLength: conversationHistory.length,
      userId: session.user.id,
      documentId
    }

    const classificationResult = await classifyWritingIntent(message, classificationContext)
    
    console.log('🔍 Intent Classification:', {
      intent: classificationResult.intent,
      confidence: classificationResult.confidence,
      reasoning: classificationResult.reasoning
    })

    // Step 2: Route to appropriate handler
    const handlerContext: HandlerContext = {
      message,
      documentId,
      documentContent,
      selection,
      cursorPosition,
      conversationHistory,
      userId: session.user.id,
      forceWebSearch
    }

    const result = await routeByIntent(classificationResult.intent, handlerContext)

    // Step 3: Format response
    const responseData = {
      message: result.content,
      metadata: {
        intent: classificationResult.intent,
        confidence: classificationResult.confidence,
        shouldTriggerLiveEdit: result.metadata.shouldTriggerLiveEdit || false,
        ...result.metadata
      }
    }

    console.log('✅ Chat Response:', {
      intent: classificationResult.intent,
      contentLength: result.content.length,
      shouldTriggerLiveEdit: result.metadata.shouldTriggerLiveEdit
    })

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('❌ Chat Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
