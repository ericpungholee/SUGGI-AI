import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchSimilarDocuments } from '@/lib/ai/vector-search'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const testQuery = searchParams.get('query') || 'test query'

    console.log(`Running quick RAG test for user ${session.user.id}`)

    // Test search with timeout to prevent hanging
    const searchPromise = searchSimilarDocuments(testQuery, session.user.id, {
      limit: 3,
      threshold: 0.1,
      includeContent: true,
      useAdaptiveRetrieval: false, // Disable adaptive to prevent recursion
      useHybridSearch: false, // Disable hybrid for simplicity
      useQueryExpansion: false,
      useQueryRewriting: false
    })

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Search timeout after 10 seconds')), 10000)
    )

    const results = await Promise.race([searchPromise, timeoutPromise])

    return NextResponse.json({
      success: true,
      message: 'RAG test completed successfully',
      query: testQuery,
      resultsCount: Array.isArray(results) ? results.length : 0,
      results: Array.isArray(results) ? results.map(r => ({
        documentId: r.documentId,
        documentTitle: r.documentTitle,
        similarity: r.similarity,
        contentLength: r.content.length
      })) : [],
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Quick RAG test error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'RAG test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
