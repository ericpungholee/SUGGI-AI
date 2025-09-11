import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchSimilarDocuments, getDocumentContext } from '@/lib/ai/vector-search'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const userId = session.user.id
    const results: any = {
      query,
      timestamp: new Date().toISOString(),
      debug: {}
    }

    console.log(`Debugging context retrieval for query: "${query}"`)

    // Check user's documents
    const userDocuments = await prisma.document.findMany({
      where: {
        userId,
        isDeleted: false
      },
      select: {
        id: true,
        title: true,
        isVectorized: true,
        wordCount: true,
        createdAt: true
      }
    })

    results.debug.userDocuments = {
      total: userDocuments.length,
      vectorized: userDocuments.filter(d => d.isVectorized).length,
      documents: userDocuments.map(d => ({
        id: d.id,
        title: d.title,
        isVectorized: d.isVectorized,
        wordCount: d.wordCount
      }))
    }

    // Test with different thresholds
    const thresholds = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]
    
    for (const threshold of thresholds) {
      try {
        console.log(`Testing with threshold: ${threshold}`)
        
        const searchResults = await searchSimilarDocuments(query, userId, {
          limit: 10,
          threshold: threshold,
          includeContent: true,
          useHybridSearch: false,
          useQueryExpansion: false,
          useQueryRewriting: false,
          searchStrategy: 'semantic',
          useAdaptiveRetrieval: false
        })

        results.debug[`threshold_${threshold}`] = {
          success: true,
          resultCount: searchResults.length,
          results: searchResults.map(r => ({
            documentTitle: r.documentTitle,
            similarity: r.similarity,
            contentPreview: r.content.substring(0, 100) + '...'
          })),
          topSimilarity: searchResults[0]?.similarity || 0
        }
      } catch (error) {
        results.debug[`threshold_${threshold}`] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Test context retrieval with different settings
    try {
      console.log('Testing context retrieval with low threshold')
      
      const context = await getDocumentContext(query, userId, undefined, 5)
      
      results.debug.contextRetrieval = {
        success: true,
        contextLength: context.length,
        hasContext: context.length > 0,
        contextPreview: context.substring(0, 500) + '...'
      }
    } catch (error) {
      results.debug.contextRetrieval = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test with manual low threshold
    try {
      console.log('Testing manual search with very low threshold')
      
      const manualResults = await searchSimilarDocuments(query, userId, {
        limit: 20,
        threshold: 0.05, // Very low threshold
        includeContent: true,
        useHybridSearch: false,
        useQueryExpansion: false,
        useQueryRewriting: false,
        searchStrategy: 'semantic',
        useAdaptiveRetrieval: false
      })

      results.debug.manualLowThreshold = {
        success: true,
        resultCount: manualResults.length,
        results: manualResults.map(r => ({
          documentTitle: r.documentTitle,
          similarity: r.similarity,
          contentPreview: r.content.substring(0, 100) + '...'
        })),
        topSimilarity: manualResults[0]?.similarity || 0,
        avgSimilarity: manualResults.length > 0 
          ? manualResults.reduce((sum, r) => sum + r.similarity, 0) / manualResults.length 
          : 0
      }
    } catch (error) {
      results.debug.manualLowThreshold = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Check Pinecone status
    try {
      const { vectorDB } = await import('@/lib/ai/vector-db')
      const stats = await vectorDB.getDocumentStats(userId)
      
      results.debug.pineconeStats = {
        success: true,
        totalChunks: stats.totalChunks,
        totalDocuments: stats.totalDocuments
      }
    } catch (error) {
      results.debug.pineconeStats = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    console.log(`Context debug completed for query: "${query}"`)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in context debug:', error)
    return NextResponse.json(
      { 
        error: 'Context debug failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
