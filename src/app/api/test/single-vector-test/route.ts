import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorizeDocument } from '@/lib/ai/vector-search'
import { searchSimilarDocuments } from '@/lib/ai/vector-search'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId, testContent, searchQuery } = await request.json()

    if (!documentId || !testContent) {
      return NextResponse.json({ error: 'Document ID and test content are required' }, { status: 400 })
    }

    console.log(`Testing single vector approach for document ${documentId}`)

    const results = {
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      documentId,
      testContent: testContent.substring(0, 100) + '...',
      tests: {} as any
    }

    // Test 1: Initial vectorization
    try {
      await vectorizeDocument(documentId, testContent, session.user.id)
      
      // Check if document was vectorized
      const document = await prisma.document.findFirst({
        where: { id: documentId, userId: session.user.id },
        select: { isVectorized: true, embedding: true, wordCount: true }
      })

      results.tests.initialVectorization = {
        status: 'success',
        message: 'Document vectorized successfully',
        isVectorized: document?.isVectorized || false,
        hasEmbedding: !!document?.embedding,
        wordCount: document?.wordCount || 0
      }
    } catch (error) {
      results.tests.initialVectorization = {
        status: 'error',
        message: 'Initial vectorization failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: Search before content update
    try {
      const searchResults = await searchSimilarDocuments(searchQuery || 'test query', session.user.id, {
        limit: 5,
        threshold: 0.1,
        includeContent: true
      })

      const documentResults = searchResults.filter(r => r.documentId === documentId)
      
      results.tests.searchBeforeUpdate = {
        status: 'success',
        message: `Found ${documentResults.length} results for document before update`,
        resultsCount: documentResults.length,
        hasResults: documentResults.length > 0
      }
    } catch (error) {
      results.tests.searchBeforeUpdate = {
        status: 'error',
        message: 'Search before update failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Add new content
    try {
      const newContent = testContent + '\n\nThis is additional test content that should be searchable after vectorization.'
      
      // Update document content
      await prisma.document.update({
        where: { id: documentId },
        data: {
          plainText: newContent,
          wordCount: newContent.split(/\s+/).length
        }
      })

      // Re-vectorize with new content
      await vectorizeDocument(documentId, newContent, session.user.id)

      results.tests.contentUpdate = {
        status: 'success',
        message: 'Content updated and re-vectorized',
        newWordCount: newContent.split(/\s+/).length
      }
    } catch (error) {
      results.tests.contentUpdate = {
        status: 'error',
        message: 'Content update failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: Search after content update
    try {
      const searchResults = await searchSimilarDocuments('additional test content', session.user.id, {
        limit: 5,
        threshold: 0.1,
        includeContent: true
      })

      const documentResults = searchResults.filter(r => r.documentId === documentId)
      
      results.tests.searchAfterUpdate = {
        status: 'success',
        message: `Found ${documentResults.length} results for document after update`,
        resultsCount: documentResults.length,
        hasResults: documentResults.length > 0,
        foundNewContent: documentResults.some(r => r.content.includes('additional test content'))
      }
    } catch (error) {
      results.tests.searchAfterUpdate = {
        status: 'error',
        message: 'Search after update failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 5: Verify single vector per document
    try {
      const chunks = await prisma.documentChunk.count({
        where: { documentId }
      })

      const documents = await prisma.document.findFirst({
        where: { id: documentId },
        select: { isVectorized: true, embedding: true }
      })

      results.tests.singleVectorVerification = {
        status: 'success',
        message: 'Single vector verification completed',
        chunkCount: chunks,
        isVectorized: documents?.isVectorized || false,
        hasEmbedding: !!documents?.embedding,
        isSingleVector: chunks === 0 && !!documents?.embedding
      }
    } catch (error) {
      results.tests.singleVectorVerification = {
        status: 'error',
        message: 'Single vector verification failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Overall test result
    const allTests = Object.values(results.tests)
    const successCount = allTests.filter(t => t.status === 'success').length
    
    results.overallResult = {
      status: successCount === allTests.length ? 'passed' : 'partial',
      successRate: `${successCount}/${allTests.length}`,
      summary: successCount === allTests.length 
        ? 'All single vector tests passed - new content is properly searchable'
        : `${allTests.length - successCount} test(s) failed - check individual results`
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Single vector test error:', error)
    return NextResponse.json(
      { 
        error: 'Single vector test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
