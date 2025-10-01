import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createRAGOrchestrator } from '@/lib/ai/rag-orchestrator'

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
      useWebSearch = false,
      maxTokens = 2000,
      conversationHistory = []
    } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    console.log('🤖 RAG Chat Request:', {
      userId: session.user.id,
      documentId,
      messageLength: message.length,
      useWebSearch,
      maxTokens
    })
    
    console.log('📝 User Prompt:', message)

    // Create RAG orchestrator
    const orchestrator = createRAGOrchestrator({
      userId: session.user.id,
      documentId,
      maxTokens,
      enableWebSearch: useWebSearch,
      webSearchTimeout: 3500,
      conversationHistory
    })

    // Process the query with conversation context
    const response = await orchestrator.processQuery(message, selection, session)

    console.log('✅ RAG Chat Response:', {
      task: response.metadata.task,
      ragConfidence: response.metadata.ragConfidence,
      coverage: response.metadata.coverage,
      sourcesUsed: response.metadata.sourcesUsed,
      processingTime: response.metadata.processingTime,
      contentLength: response.content.length
    })

    return NextResponse.json({
      message: response.content,
      citations: response.citations,
      metadata: response.metadata,
      verification: {
        isValid: response.verification.isValid,
        warnings: response.verification.warnings
      },
      // Include live editing data if available
      ...(response.liveEditContent && {
        liveEditContent: response.liveEditContent
      })
    })

  } catch (error) {
    console.error('❌ RAG Chat Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process RAG query',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
