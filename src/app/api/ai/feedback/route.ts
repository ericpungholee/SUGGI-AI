import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hybridLearnedRouter } from '@/lib/ai/hybrid-learned-router'

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
      query, 
      correctIntent, 
      predictedIntent, 
      confidence,
      context 
    } = body

    // Validate required fields
    if (!query || !correctIntent || !predictedIntent) {
      return NextResponse.json(
        { error: 'Missing required fields: query, correctIntent, predictedIntent' },
        { status: 400 }
      )
    }

    // Validate intent values
    const validIntents = ['ask', 'web_search', 'rag_query', 'edit_request', 'editor_write', 'other']
    if (!validIntents.includes(correctIntent) || !validIntents.includes(predictedIntent)) {
      return NextResponse.json(
        { error: 'Invalid intent values. Must be one of: ' + validIntents.join(', ') },
        { status: 400 }
      )
    }

    console.log('📝 Router Feedback:', {
      userId: session.user.id,
      query: query.substring(0, 100) + '...',
      correctIntent,
      predictedIntent,
      confidence: confidence || 'not provided',
      timestamp: new Date().toISOString()
    })

    // Add feedback to the hybrid learned router
    await hybridLearnedRouter.addFeedback(
      query,
      correctIntent,
      predictedIntent,
      confidence || 0.5
    )

    // Get updated metrics
    const metrics = hybridLearnedRouter.getMetrics()
    const status = hybridLearnedRouter.getStatus()

    const response = {
      success: true,
      message: 'Feedback added successfully',
      timestamp: new Date().toISOString(),
      feedback: {
        query: query.substring(0, 100) + '...',
        correctIntent,
        predictedIntent,
        confidence: confidence || 0.5,
        wasCorrect: correctIntent === predictedIntent
      },
      systemMetrics: {
        totalRequests: metrics.totalRequests,
        averageConfidence: metrics.averageConfidence,
        embeddingHits: metrics.embeddingHits,
        classifierHits: metrics.classifierHits,
        metaClassifierHits: metrics.metaClassifierHits
      },
      systemStatus: {
        initialized: status.initialized,
        totalVectors: status.embeddingStats.totalVectors,
        classifierTrained: status.classifierStatus.isTrained
      }
    }

    console.log('✅ Feedback processed:', {
      wasCorrect: correctIntent === predictedIntent,
      totalRequests: metrics.totalRequests,
      averageConfidence: metrics.averageConfidence
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Router Feedback Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current system metrics
    const metrics = hybridLearnedRouter.getMetrics()
    const status = hybridLearnedRouter.getStatus()

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        totalRequests: metrics.totalRequests,
        averageConfidence: metrics.averageConfidence,
        averageProcessingTime: metrics.averageProcessingTime,
        intentDistribution: metrics.intentDistribution,
        methodDistribution: {
          embeddingHits: metrics.embeddingHits,
          classifierHits: metrics.classifierHits,
          metaClassifierHits: metrics.metaClassifierHits
        }
      },
      systemStatus: {
        initialized: status.initialized,
        embeddingStats: status.embeddingStats,
        classifierStatus: status.classifierStatus
      },
      feedbackInstructions: {
        endpoint: '/api/ai/feedback',
        method: 'POST',
        requiredFields: ['query', 'correctIntent', 'predictedIntent'],
        optionalFields: ['confidence', 'context'],
        validIntents: ['ask', 'web_search', 'rag_query', 'edit_request', 'editor_write', 'other']
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Router Feedback Status Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch feedback status',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
