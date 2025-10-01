import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hybridLearnedRouter } from '@/lib/ai/hybrid-learned-router'
import { embeddingService } from '@/lib/ai/embedding-service'
import { learnedClassifier } from '@/lib/ai/learned-classifier'
import { llmMetaClassifier } from '@/lib/ai/llm-meta-classifier'
import { routerService } from '@/lib/ai/router-service'
import { ragAdapter } from '@/lib/ai/rag-adapter'
import { createRAGOrchestrator } from '@/lib/ai/rag-orchestrator'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const testType = searchParams.get('type') || 'full'
    const testQuery = searchParams.get('query') || 'What is machine learning?'

    console.log('🧪 AI System Test:', {
      userId: session.user.id,
      testType,
      testQuery,
      timestamp: new Date().toISOString()
    })

    const results = {
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      testType,
      testQuery,
      tests: {} as any
    }

    // Test 1: Hybrid Learned Router
    if (testType === 'full' || testType === 'router') {
      try {
        console.log('Testing Hybrid Learned Router...')
        const routerContext = {
          has_attached_docs: false,
          doc_ids: [],
          is_selection_present: false,
          selection_length: 0,
          recent_tools: [],
          conversation_length: 0,
          user_id: session.user.id
        }
        
        const routerResult = await hybridLearnedRouter.classifyIntent(testQuery, routerContext)
        
        results.tests.hybridRouter = {
          success: true,
          intent: routerResult.classification.intent,
          confidence: routerResult.classification.confidence,
          method: (routerResult as any).explanation?.method || 'unknown',
          reasoning: (routerResult as any).explanation?.reasoning,
          processingTime: routerResult.processing_time,
          fallbackUsed: routerResult.fallback_used,
          slots: routerResult.classification.slots
        }
        console.log('✅ Hybrid Learned Router test passed')
      } catch (error) {
        results.tests.hybridRouter = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('❌ Hybrid Learned Router test failed:', error)
      }
    }

    // Test 2: Embedding Service
    if (testType === 'full' || testType === 'embeddings') {
      try {
        console.log('Testing Embedding Service...')
        const embedding = await embeddingService.getEmbedding(testQuery)
        const distribution = await embeddingService.getIntentDistribution(testQuery, 5)
        const stats = embeddingService.getStats()
        
        results.tests.embeddingService = {
          success: true,
          embeddingLength: embedding.length,
          intentDistribution: distribution,
          totalVectors: stats.totalVectors,
          intentDistributionStats: stats.intentDistribution
        }
        console.log('✅ Embedding Service test passed')
      } catch (error) {
        results.tests.embeddingService = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('❌ Embedding Service test failed:', error)
      }
    }

    // Test 3: Learned Classifier
    if (testType === 'full' || testType === 'classifier') {
      try {
        console.log('Testing Learned Classifier...')
        const classifierResult = await learnedClassifier.classify(testQuery)
        const status = learnedClassifier.getStatus()
        
        results.tests.learnedClassifier = {
          success: true,
          intent: classifierResult.intent,
          confidence: classifierResult.confidence,
          probabilities: classifierResult.probabilities,
          isTrained: status.isTrained,
          weightsLoaded: status.weightsLoaded,
          intents: status.intents
        }
        console.log('✅ Learned Classifier test passed')
      } catch (error) {
        results.tests.learnedClassifier = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('❌ Learned Classifier test failed:', error)
      }
    }

    // Test 4: LLM Meta-Classifier
    if (testType === 'full' || testType === 'meta-classifier') {
      try {
        console.log('Testing LLM Meta-Classifier...')
        const context = { has_attached_docs: false, is_selection_present: false, conversation_length: 0 }
        const metaResult = await llmMetaClassifier.classify(testQuery, context)
        
        results.tests.llmMetaClassifier = {
          success: true,
          intent: metaResult.classification.intent,
          confidence: metaResult.classification.confidence,
          reasoning: metaResult.reasoning,
          examplesUsed: metaResult.examplesUsed.length,
          processingTime: metaResult.processingTime
        }
        console.log('✅ LLM Meta-Classifier test passed')
      } catch (error) {
        results.tests.llmMetaClassifier = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('❌ LLM Meta-Classifier test failed:', error)
      }
    }

    // Test 5: Router Service
    if (testType === 'full' || testType === 'router-service') {
      try {
        console.log('Testing Router Service...')
        const routerContext = {
          has_attached_docs: false,
          doc_ids: [],
          is_selection_present: false,
          selection_length: 0,
          recent_tools: [],
          conversation_length: 0,
          user_id: session.user.id
        }
        
        const routerResult = await routerService.classifyIntent(testQuery, routerContext)
        const metrics = routerService.getMetrics()
        
        results.tests.routerService = {
          success: true,
          intent: routerResult.classification.intent,
          confidence: routerResult.classification.confidence,
          processingTime: routerResult.processing_time,
          metrics: {
            totalRequests: metrics.total_requests,
            averageConfidence: metrics.average_confidence,
            intentDistribution: metrics.intent_distribution,
            performanceStats: metrics.performance_stats
          }
        }
        console.log('✅ Router Service test passed')
      } catch (error) {
        results.tests.routerService = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('❌ Router Service test failed:', error)
      }
    }

    // Test 6: RAG Adapter
    if (testType === 'full' || testType === 'rag') {
      try {
        console.log('Testing RAG Adapter...')
        const ragResults = await ragAdapter.search(testQuery, {
          topK: 5,
          projectId: session.user.id
        })
        
        results.tests.ragAdapter = {
          success: true,
          chunksFound: ragResults.length,
          confidence: ragAdapter.confidence(ragResults),
          chunks: ragResults.map(chunk => ({
            id: chunk.id,
            score: chunk.score,
            tokens: chunk.tokens,
            preview: chunk.text.substring(0, 100) + '...'
          }))
        }
        console.log('✅ RAG Adapter test passed')
      } catch (error) {
        results.tests.ragAdapter = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('❌ RAG Adapter test failed:', error)
      }
    }

    // Test 7: Full RAG Orchestrator
    if (testType === 'full' || testType === 'orchestrator') {
      try {
        console.log('Testing RAG Orchestrator...')
        const orchestrator = createRAGOrchestrator({
          userId: session.user.id,
          maxTokens: 1000,
          enableWebSearch: false // Disable web search for test
        })
        
        const response = await orchestrator.processQuery(testQuery, undefined, session)
        
        results.tests.ragOrchestrator = {
          success: true,
          task: response.metadata.task,
          ragConfidence: response.metadata.ragConfidence,
          coverage: response.metadata.coverage,
          processingTime: response.metadata.processingTime,
          sourcesUsed: response.metadata.sourcesUsed,
          contentLength: response.content.length,
          citationsCount: response.citations.length
        }
        console.log('✅ RAG Orchestrator test passed')
      } catch (error) {
        results.tests.ragOrchestrator = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('❌ RAG Orchestrator test failed:', error)
      }
    }

    // Calculate overall success
    const allTests = Object.values(results.tests)
    const successCount = allTests.filter(test => test.success).length
    const totalTests = allTests.length
    const successRate = totalTests > 0 ? (successCount / totalTests) * 100 : 0
    
    console.log(`🎯 AI System Test Complete: ${successCount}/${totalTests} tests passed (${successRate.toFixed(1)}%)`)

    return NextResponse.json({
      ...results,
      summary: {
        totalTests,
        successfulTests: successCount,
        failedTests: totalTests - successCount,
        successRate: successRate.toFixed(1) + '%',
        overallStatus: successRate >= 80 ? 'healthy' : successRate >= 60 ? 'degraded' : 'unhealthy'
      }
    })

  } catch (error) {
    console.error('❌ AI System Test Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'AI system test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
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
    const { 
      testQueries = [
        "What is machine learning?",
        "What's the latest news about Tesla?",
        "What does my research document say about climate change?",
        "Write an essay about renewable energy",
        "Rewrite this paragraph to be more concise"
      ],
      testType = 'full'
    } = body

    console.log('🧪 Batch AI System Test:', {
      userId: session.user.id,
      testQueries: testQueries.length,
      testType,
      timestamp: new Date().toISOString()
    })

    const batchResults = {
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      testType,
      testQueries: testQueries.length,
      results: [] as any[],
      summary: {
        totalTests: 0,
        successfulTests: 0,
        failedTests: 0,
        averageConfidence: 0,
        intentDistribution: {} as Record<string, number>
      }
    }

    // Run tests for each query
    for (const query of testQueries) {
      try {
        const routerContext = {
          has_attached_docs: false,
          doc_ids: [],
          is_selection_present: false,
          selection_length: 0,
          recent_tools: [],
          conversation_length: 0,
          user_id: session.user.id
        }
        
        const routerResult = await routerService.classifyIntent(query, routerContext)
        
        batchResults.results.push({
          query,
          intent: routerResult.classification.intent,
          confidence: routerResult.classification.confidence,
          method: (routerResult as any).explanation?.method || 'unknown',
          processingTime: routerResult.processing_time,
          success: true
        })
        
        batchResults.summary.totalTests++
        batchResults.summary.successfulTests++
        batchResults.summary.averageConfidence += routerResult.classification.confidence
        
        // Track intent distribution
        const intent = routerResult.classification.intent
        batchResults.summary.intentDistribution[intent] = (batchResults.summary.intentDistribution[intent] || 0) + 1
        
      } catch (error) {
        batchResults.results.push({
          query,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        })
        
        batchResults.summary.totalTests++
        batchResults.summary.failedTests++
      }
    }

    // Calculate final metrics
    if (batchResults.summary.successfulTests > 0) {
      batchResults.summary.averageConfidence /= batchResults.summary.successfulTests
    }

    const successRate = batchResults.summary.totalTests > 0 
      ? (batchResults.summary.successfulTests / batchResults.summary.totalTests) * 100 
      : 0

    batchResults.summary.successRate = successRate.toFixed(1) + '%'
    batchResults.summary.overallStatus = successRate >= 80 ? 'healthy' : successRate >= 60 ? 'degraded' : 'unhealthy'

    console.log(`🎯 Batch AI System Test Complete: ${batchResults.summary.successfulTests}/${batchResults.summary.totalTests} tests passed (${successRate.toFixed(1)}%)`)

    return NextResponse.json(batchResults)

  } catch (error) {
    console.error('❌ Batch AI System Test Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Batch AI system test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
