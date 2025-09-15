import { NextRequest, NextResponse } from 'next/server'
import { processRealTimeEditRequest } from '@/lib/ai/real-time-edit-agent-server'

export async function POST(request: NextRequest) {
  try {
    const { userMessage, documentId, documentContent, conversationHistory } = await request.json()

    if (!userMessage || !documentId) {
      return NextResponse.json(
        { error: 'Missing required fields: userMessage, documentId' },
        { status: 400 }
      )
    }

    console.log('🤖 Processing real-time edit request:', {
      userMessage: userMessage.substring(0, 100),
      documentId,
      contentLength: documentContent?.length || 0
    })

    // Process the edit request through LangGraph
    const result = await processRealTimeEditRequest(
      userMessage,
      documentId,
      documentContent || '',
      conversationHistory || []
    )

    console.log('✅ Real-time edit request processed:', {
      hasSession: !!result.agentTypingSession,
      hasBlocks: result.typingBlocks?.length || 0,
      processingStep: result.processingStep,
      hasError: !!result.error,
      detectedIntent: result.detectedIntent
    })

    // Always return success, even for non-edit requests
    // The client will handle the different cases based on the result

    return NextResponse.json({
      success: true,
      result
    })

  } catch (error) {
    console.error('❌ Error processing real-time edit request:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process edit request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
