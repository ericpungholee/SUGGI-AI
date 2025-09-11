import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createEmbedding } from '@/lib/ai/embeddings'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query = 'test query for embedding' } = await request.json()
    const results: any = {
      query,
      timestamp: new Date().toISOString(),
      tests: {}
    }

    console.log(`Testing embedding fix for query: "${query}"`)

    // Test 1: Generate single embedding
    try {
      console.log('Test 1: Generate single embedding')
      const embeddingResult = await createEmbedding(query)
      
      results.tests.singleEmbedding = {
        success: true,
        dimension: embeddingResult.embedding.length,
        expectedDimension: 1536,
        dimensionMatch: embeddingResult.embedding.length === 1536,
        tokenCount: embeddingResult.tokenCount,
        firstFewValues: embeddingResult.embedding.slice(0, 5)
      }
    } catch (error) {
      results.tests.singleEmbedding = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }

    // Test 2: Generate multiple embeddings
    try {
      console.log('Test 2: Generate multiple embeddings')
      const { createEmbeddings } = await import('@/lib/ai/embeddings')
      const texts = [query, 'another test query', 'third test query']
      const embeddingsResult = await createEmbeddings(texts)
      
      results.tests.multipleEmbeddings = {
        success: true,
        count: embeddingsResult.length,
        dimensions: embeddingsResult.map(e => e.embedding.length),
        allMatchExpected: embeddingsResult.every(e => e.embedding.length === 1536),
        tokenCounts: embeddingsResult.map(e => e.tokenCount)
      }
    } catch (error) {
      results.tests.multipleEmbeddings = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }

    // Calculate overall success
    const successfulTests = Object.values(results.tests).filter((test: any) => test.success).length
    const totalTests = Object.keys(results.tests).length
    
    results.summary = {
      totalTests,
      successfulTests,
      successRate: (successfulTests / totalTests) * 100,
      embeddingWorking: results.tests.singleEmbedding?.success || false,
      batchEmbeddingWorking: results.tests.multipleEmbeddings?.success || false
    }

    console.log(`Embedding fix test completed for query: "${query}"`)
    console.log(`Success rate: ${results.summary.successRate}%`)
    console.log(`Single embedding working: ${results.summary.embeddingWorking}`)
    console.log(`Batch embedding working: ${results.summary.batchEmbeddingWorking}`)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in embedding fix test:', error)
    return NextResponse.json(
      { 
        error: 'Embedding fix test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
