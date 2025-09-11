import { NextRequest, NextResponse } from 'next/server'
import { searchSimilarDocuments } from '@/lib/ai/vector-search'

export async function POST(request: NextRequest) {
  try {
    const { query, documentId, userId } = await request.json()

    if (!query || !documentId || !userId) {
      return NextResponse.json({ 
        error: 'Query, documentId, and userId are required' 
      }, { status: 400 })
    }

    console.log(`Debug search with query: "${query}"`)

    // Test search results
    const searchResults = await searchSimilarDocuments(query, userId, {
      limit: 10,
      threshold: 0.1,
      includeContent: true,
      useHybridSearch: true,
      useQueryExpansion: true,
      useQueryRewriting: true,
      searchStrategy: 'adaptive',
      useAdaptiveRetrieval: true
    })

    console.log(`Found ${searchResults.length} search results`)

    // Filter by specific document
    const relevantResults = searchResults.filter(result => result.documentId === documentId)
    console.log(`Filtered to ${relevantResults.length} relevant results`)

    return NextResponse.json({
      success: true,
      query,
      documentId,
      userId,
      searchResults: {
        total: searchResults.length,
        relevant: relevantResults.length,
        details: relevantResults.map(result => ({
          id: result.id,
          documentId: result.documentId,
          documentTitle: result.documentTitle,
          similarity: result.similarity,
          contentLength: result.content?.length || 0,
          contentPreview: result.content?.substring(0, 200) + '...',
          fullContent: result.content,
          metadata: result.metadata
        }))
      }
    })
  } catch (error) {
    console.error('Error in debug search:', error)
    return NextResponse.json(
      { 
        error: 'Debug search failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}