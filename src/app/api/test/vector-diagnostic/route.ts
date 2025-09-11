import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorDB } from '@/lib/ai/vector-db'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const testQuery = searchParams.get('query') || 'test query'

    console.log(`Running vector diagnostic for user ${session.user.id}`)

    const results = {
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      testQuery,
      diagnostics: {} as any
    }

    // Test 1: Environment variables
    results.diagnostics.environment = {
      hasPineconeApiKey: !!process.env.PINECONE_API_KEY,
      pineconeIndexName: process.env.PINECONE_INDEX_NAME || 'ssugi-docs',
      nodeEnv: process.env.NODE_ENV
    }

    // Test 2: Vector database initialization
    try {
      await vectorDB.initialize()
      results.diagnostics.vectorDBInit = {
        status: 'success',
        message: 'Vector database initialized successfully'
      }
    } catch (error) {
      results.diagnostics.vectorDBInit = {
        status: 'error',
        message: 'Vector database initialization failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Document statistics
    try {
      const stats = await vectorDB.getDocumentStats(session.user.id)
      results.diagnostics.documentStats = {
        status: 'success',
        message: 'Document statistics retrieved',
        stats
      }
    } catch (error) {
      results.diagnostics.documentStats = {
        status: 'error',
        message: 'Failed to get document statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: Database documents
    try {
      const documents = await prisma.document.findMany({
        where: {
          userId: session.user.id,
          isDeleted: false
        },
        select: {
          id: true,
          title: true,
          isVectorized: true,
          wordCount: true,
          createdAt: true
        },
        take: 5
      })

      results.diagnostics.databaseDocuments = {
        status: 'success',
        message: `Found ${documents.length} documents in database`,
        documents: documents.map(doc => ({
          id: doc.id,
          title: doc.title,
          isVectorized: doc.isVectorized,
          wordCount: doc.wordCount,
          createdAt: doc.createdAt
        }))
      }
    } catch (error) {
      results.diagnostics.databaseDocuments = {
        status: 'error',
        message: 'Failed to get database documents',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 5: Simple vector search
    try {
      const searchResults = await vectorDB.searchDocuments(testQuery, session.user.id, {
        topK: 3,
        threshold: 0.1,
        includeMetadata: true
      })

      results.diagnostics.vectorSearch = {
        status: 'success',
        message: `Vector search returned ${searchResults.length} results`,
        results: searchResults.map(r => ({
          id: r.id,
          score: r.score,
          hasContent: !!r.content,
          contentLength: r.content?.length || 0,
          hasMetadata: !!r.metadata,
          documentId: r.metadata?.documentId
        }))
      }
    } catch (error) {
      results.diagnostics.vectorSearch = {
        status: 'error',
        message: 'Vector search failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }

    // Overall health check
    const allTests = Object.values(results.diagnostics)
    const successCount = allTests.filter(t => t.status === 'success').length
    
    results.overallHealth = {
      status: successCount === allTests.length ? 'healthy' : 'issues',
      successRate: `${successCount}/${allTests.length}`,
      summary: successCount === allTests.length 
        ? 'All vector database components are working correctly'
        : `${allTests.length - successCount} component(s) have issues`
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Vector diagnostic error:', error)
    return NextResponse.json(
      { 
        error: 'Vector diagnostic failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
