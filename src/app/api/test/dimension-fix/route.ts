import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createEmbedding } from '@/lib/ai/embeddings'
import { vectorDB } from '@/lib/ai/vector-db'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query = 'test query' } = await request.json()
    const userId = session.user.id
    const results: any = {
      query,
      timestamp: new Date().toISOString(),
      tests: {}
    }

    console.log(`Testing dimension fix for query: "${query}"`)

    // Test 1: Generate embedding and check dimensions
    try {
      console.log('Test 1: Generate embedding')
      const embeddingResult = await createEmbedding(query)
      
      results.tests.embeddingGeneration = {
        success: true,
        dimension: embeddingResult.embedding.length,
        expectedDimension: 1536,
        dimensionMatch: embeddingResult.embedding.length === 1536,
        tokenCount: embeddingResult.tokenCount,
        firstFewValues: embeddingResult.embedding.slice(0, 5)
      }
    } catch (error) {
      results.tests.embeddingGeneration = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: Test Pinecone search with correct dimensions
    try {
      console.log('Test 2: Pinecone search')
      const searchResults = await vectorDB.searchDocuments(query, userId, {
        topK: 5,
        threshold: 0.1,
        includeMetadata: true
      })

      results.tests.pineconeSearch = {
        success: true,
        resultCount: searchResults.length,
        results: searchResults.map(r => ({
          id: r.id,
          score: r.score,
          documentTitle: r.metadata?.documentTitle || 'Unknown',
          contentPreview: r.content.substring(0, 100) + '...'
        })),
        topScore: searchResults[0]?.score || 0
      }
    } catch (error) {
      results.tests.pineconeSearch = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error instanceof Error ? error.stack : undefined
      }
    }

    // Test 3: Test vector database initialization
    try {
      console.log('Test 3: Vector DB initialization')
      await vectorDB.initialize()
      
      results.tests.vectorDBInit = {
        success: true,
        message: 'Vector database initialized successfully'
      }
    } catch (error) {
      results.tests.vectorDBInit = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: Test document stats
    try {
      console.log('Test 4: Document stats')
      const stats = await vectorDB.getDocumentStats(userId)
      
      results.tests.documentStats = {
        success: true,
        totalChunks: stats.totalChunks,
        totalDocuments: stats.totalDocuments
      }
    } catch (error) {
      results.tests.documentStats = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Calculate overall success
    const successfulTests = Object.values(results.tests).filter((test: any) => test.success).length
    const totalTests = Object.keys(results.tests).length
    
    results.summary = {
      totalTests,
      successfulTests,
      successRate: (successfulTests / totalTests) * 100,
      dimensionFixed: results.tests.embeddingGeneration?.dimensionMatch || false,
      pineconeWorking: results.tests.pineconeSearch?.success || false
    }

    console.log(`Dimension fix test completed for query: "${query}"`)
    console.log(`Success rate: ${results.summary.successRate}%`)
    console.log(`Dimension fixed: ${results.summary.dimensionFixed}`)
    console.log(`Pinecone working: ${results.summary.pineconeWorking}`)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in dimension fix test:', error)
    return NextResponse.json(
      { 
        error: 'Dimension fix test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
