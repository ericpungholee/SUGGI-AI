import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorDB } from '@/lib/ai/vector-db'
import { searchSimilarDocuments, getDocumentContext } from '@/lib/ai/vector-search'
import { processAIChat } from '@/lib/ai/ai-chat'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const testQuery = searchParams.get('query') || 'test query'
    const documentId = searchParams.get('documentId')

    console.log(`Running RAG system test for user ${session.user.id}`)

    const results = {
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      testQuery,
      documentId,
      tests: {} as any
    }

    // Test 1: Vector Database Connection
    try {
      await vectorDB.initialize()
      const stats = await vectorDB.getDocumentStats(session.user.id)
      results.tests.vectorDB = {
        status: 'success',
        message: 'Vector database connected successfully',
        stats
      }
    } catch (error) {
      results.tests.vectorDB = {
        status: 'error',
        message: 'Vector database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: Document Search
    try {
      const searchResults = await searchSimilarDocuments(testQuery, session.user.id, {
        limit: 5,
        threshold: 0.1,
        includeContent: true
      })
      results.tests.documentSearch = {
        status: 'success',
        message: `Found ${searchResults.length} search results`,
        results: searchResults.map(r => ({
          documentId: r.documentId,
          documentTitle: r.documentTitle,
          similarity: r.similarity,
          contentLength: r.content.length
        }))
      }
    } catch (error) {
      results.tests.documentSearch = {
        status: 'error',
        message: 'Document search failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Context Retrieval
    try {
      const context = await getDocumentContext(testQuery, session.user.id, documentId || undefined, 3)
      results.tests.contextRetrieval = {
        status: 'success',
        message: `Retrieved context with ${context.length} characters`,
        contextLength: context.length,
        hasContext: context.length > 0
      }
    } catch (error) {
      results.tests.contextRetrieval = {
        status: 'error',
        message: 'Context retrieval failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: AI Chat (if context is available)
    try {
      const context = await getDocumentContext(testQuery, session.user.id, documentId || undefined, 3)
      if (context.length > 0) {
        const chatResponse = await processAIChat({
          message: testQuery,
          userId: session.user.id,
          documentId: documentId || undefined,
          includeContext: true
        })
        
        results.tests.aiChat = {
          status: 'success',
          message: 'AI chat with context successful',
          responseLength: chatResponse.message.length,
          hasResponse: chatResponse.message.length > 0,
          conversationId: chatResponse.conversationId
        }
      } else {
        results.tests.aiChat = {
          status: 'skipped',
          message: 'Skipped AI chat test - no context available'
        }
      }
    } catch (error) {
      results.tests.aiChat = {
        status: 'error',
        message: 'AI chat failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 5: Document Statistics
    try {
      const documentCount = await prisma.document.count({
        where: {
          userId: session.user.id,
          isDeleted: false
        }
      })

      const vectorizedCount = await prisma.document.count({
        where: {
          userId: session.user.id,
          isDeleted: false,
          isVectorized: true
        }
      })

      const chunkCount = await prisma.documentChunk.count({
        where: {
          document: {
            userId: session.user.id,
            isDeleted: false
          }
        }
      })

      results.tests.documentStats = {
        status: 'success',
        message: 'Document statistics retrieved',
        totalDocuments: documentCount,
        vectorizedDocuments: vectorizedCount,
        totalChunks: chunkCount,
        vectorizationRate: documentCount > 0 ? (vectorizedCount / documentCount * 100).toFixed(1) + '%' : '0%'
      }
    } catch (error) {
      results.tests.documentStats = {
        status: 'error',
        message: 'Document statistics failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Overall system health
    const allTests = Object.values(results.tests)
    const successCount = allTests.filter(t => t.status === 'success').length
    const errorCount = allTests.filter(t => t.status === 'error').length
    
    results.overallHealth = {
      status: errorCount === 0 ? 'healthy' : errorCount < allTests.length ? 'degraded' : 'unhealthy',
      successRate: `${successCount}/${allTests.length}`,
      summary: errorCount === 0 
        ? 'All RAG system components are working correctly'
        : `${errorCount} component(s) have issues that need attention`
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('RAG system test error:', error)
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
