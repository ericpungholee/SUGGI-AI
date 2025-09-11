import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchSimilarDocuments, getDocumentContext } from '@/lib/ai/vector-search'
import { processAIChat } from '@/lib/ai/ai-chat'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, testType = 'comprehensive' } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const userId = session.user.id
    const results: any = {
      query,
      testType,
      timestamp: new Date().toISOString(),
      tests: {}
    }

    console.log(`Running accuracy test for query: "${query}"`)

    // Test 1: Basic Vector Search
    try {
      console.log('Test 1: Basic Vector Search')
      const startTime = Date.now()
      
      const searchResults = await searchSimilarDocuments(query, userId, {
        limit: 10,
        threshold: 0.3,
        includeContent: true,
        useHybridSearch: true,
        useQueryExpansion: false,
        useQueryRewriting: false,
        searchStrategy: 'semantic',
        useAdaptiveRetrieval: false
      })

      const searchTime = Date.now() - startTime

      results.tests.basicSearch = {
        success: true,
        duration: searchTime,
        resultCount: searchResults.length,
        results: searchResults.map(r => ({
          documentTitle: r.documentTitle,
          similarity: r.similarity,
          contentPreview: r.content.substring(0, 200) + '...',
          chunkIndex: r.chunkIndex
        })),
        topSimilarity: searchResults[0]?.similarity || 0,
        avgSimilarity: searchResults.length > 0 
          ? searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length 
          : 0
      }
    } catch (error) {
      results.tests.basicSearch = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: Enhanced Hybrid Search
    try {
      console.log('Test 2: Enhanced Hybrid Search')
      const startTime = Date.now()
      
      const hybridResults = await searchSimilarDocuments(query, userId, {
        limit: 10,
        threshold: 0.25,
        includeContent: true,
        useHybridSearch: true,
        useQueryExpansion: true,
        useQueryRewriting: true,
        searchStrategy: 'hybrid',
        useAdaptiveRetrieval: false
      })

      const hybridTime = Date.now() - startTime

      results.tests.hybridSearch = {
        success: true,
        duration: hybridTime,
        resultCount: hybridResults.length,
        results: hybridResults.map(r => ({
          documentTitle: r.documentTitle,
          similarity: r.similarity,
          contentPreview: r.content.substring(0, 200) + '...',
          chunkIndex: r.chunkIndex
        })),
        topSimilarity: hybridResults[0]?.similarity || 0,
        avgSimilarity: hybridResults.length > 0 
          ? hybridResults.reduce((sum, r) => sum + r.similarity, 0) / hybridResults.length 
          : 0
      }
    } catch (error) {
      results.tests.hybridSearch = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Adaptive Retrieval
    try {
      console.log('Test 3: Adaptive Retrieval')
      const startTime = Date.now()
      
      const adaptiveResults = await searchSimilarDocuments(query, userId, {
        limit: 10,
        threshold: 0.2,
        includeContent: true,
        useHybridSearch: true,
        useQueryExpansion: true,
        useQueryRewriting: true,
        searchStrategy: 'adaptive',
        useAdaptiveRetrieval: true
      })

      const adaptiveTime = Date.now() - startTime

      results.tests.adaptiveSearch = {
        success: true,
        duration: adaptiveTime,
        resultCount: adaptiveResults.length,
        results: adaptiveResults.map(r => ({
          documentTitle: r.documentTitle,
          similarity: r.similarity,
          contentPreview: r.content.substring(0, 200) + '...',
          chunkIndex: r.chunkIndex
        })),
        topSimilarity: adaptiveResults[0]?.similarity || 0,
        avgSimilarity: adaptiveResults.length > 0 
          ? adaptiveResults.reduce((sum, r) => sum + r.similarity, 0) / adaptiveResults.length 
          : 0
      }
    } catch (error) {
      results.tests.adaptiveSearch = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: Context Retrieval
    try {
      console.log('Test 4: Context Retrieval')
      const startTime = Date.now()
      
      const context = await getDocumentContext(query, userId, undefined, 5)

      const contextTime = Date.now() - startTime

      results.tests.contextRetrieval = {
        success: true,
        duration: contextTime,
        contextLength: context.length,
        contextPreview: context.substring(0, 500) + '...',
        hasContent: context.length > 0
      }
    } catch (error) {
      results.tests.contextRetrieval = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 5: Full AI Chat (if testType is comprehensive)
    if (testType === 'comprehensive') {
      try {
        console.log('Test 5: Full AI Chat')
        const startTime = Date.now()
        
        const aiResponse = await processAIChat(query, userId, undefined, {
          abortSignal: new AbortController().signal
        })

        const aiTime = Date.now() - startTime

        results.tests.aiChat = {
          success: true,
          duration: aiTime,
          responseLength: aiResponse.length,
          responsePreview: aiResponse.substring(0, 500) + '...',
          hasResponse: aiResponse.length > 0
        }
      } catch (error) {
        results.tests.aiChat = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Calculate overall accuracy metrics
    const successfulTests = Object.values(results.tests).filter((test: any) => test.success).length
    const totalTests = Object.keys(results.tests).length
    
    results.summary = {
      totalTests,
      successfulTests,
      successRate: (successfulTests / totalTests) * 100,
      avgSearchTime: Object.values(results.tests)
        .filter((test: any) => test.success && test.duration)
        .reduce((sum: number, test: any) => sum + test.duration, 0) / 
        Object.values(results.tests).filter((test: any) => test.success && test.duration).length || 0,
      bestSimilarity: Math.max(
        ...Object.values(results.tests)
          .filter((test: any) => test.success && test.topSimilarity)
          .map((test: any) => test.topSimilarity)
      ) || 0
    }

    console.log(`Accuracy test completed for query: "${query}"`)
    console.log(`Success rate: ${results.summary.successRate}%`)
    console.log(`Best similarity: ${results.summary.bestSimilarity}`)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in accuracy test:', error)
    return NextResponse.json(
      { 
        error: 'Accuracy test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
