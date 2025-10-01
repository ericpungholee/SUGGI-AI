import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ragAdapter } from '@/lib/ai/rag-adapter'
import { routeQuery } from '@/lib/ai/rag-router'
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
    const testQuery = searchParams.get('query') || 'test query'

    console.log('🧪 RAG System Test:', {
      userId: session.user.id,
      testQuery
    })

    const results = {
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      testQuery,
      tests: {
        ragAdapter: null as any,
        routing: null as any,
        orchestrator: null as any
      }
    }

    // Test 1: RAG Adapter
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

    // Test 2: Routing
    try {
      console.log('Testing Routing...')
      const route = await routeQuery(testQuery, undefined, session)
      
      results.tests.routing = {
        success: true,
        task: route.task,
        needs: route.needs,
        constraints: route.constraints
      }
      console.log('✅ Routing test passed')
    } catch (error) {
      results.tests.routing = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      console.error('❌ Routing test failed:', error)
    }

    // Test 3: Full Orchestrator (simplified)
    try {
      console.log('Testing Orchestrator...')
      const orchestrator = createRAGOrchestrator({
        userId: session.user.id,
        maxTokens: 1000,
        enableWebSearch: false // Disable web search for test
      })
      
      const response = await orchestrator.processQuery(testQuery, undefined, session)
      
      results.tests.orchestrator = {
        success: true,
        task: response.metadata.task,
        ragConfidence: response.metadata.ragConfidence,
        coverage: response.metadata.coverage,
        processingTime: response.metadata.processingTime,
        sourcesUsed: response.metadata.sourcesUsed,
        contentLength: response.content.length,
        citationsCount: response.citations.length
      }
      console.log('✅ Orchestrator test passed')
    } catch (error) {
      results.tests.orchestrator = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      console.error('❌ Orchestrator test failed:', error)
    }

    // Calculate overall success
    const allTests = Object.values(results.tests)
    const successCount = allTests.filter(test => test.success).length
    const totalTests = allTests.length
    
    console.log(`🎯 RAG System Test Complete: ${successCount}/${totalTests} tests passed`)

    return NextResponse.json({
      ...results,
      summary: {
        totalTests,
        passedTests: successCount,
        failedTests: totalTests - successCount,
        overallSuccess: successCount === totalTests
      }
    })

  } catch (error) {
    console.error('❌ RAG System Test Error:', error)
    
    return NextResponse.json(
      { 
        error: 'RAG system test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
