import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { processDocument, processDocuments, getDocumentProcessingStatus } from '@/lib/ai/document-processor'
import { batchVectorizeDocuments } from '@/lib/ai/incremental-vectorization'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      documentId, 
      documentIds, 
      force = false, 
      useIncremental = true,
      batch = false 
    } = body

    if (batch && documentIds && Array.isArray(documentIds)) {
      // Batch process multiple documents
      const results = await batchVectorizeDocuments(documentIds, force)
      
      const summary = {
        total: documentIds.length,
        successful: Array.from(results.values()).filter(r => r.success).length,
        failed: Array.from(results.values()).filter(r => !r.success).length,
        totalProcessingTime: Array.from(results.values()).reduce((sum, r) => sum + r.processingTime, 0),
        totalChunksProcessed: Array.from(results.values()).reduce((sum, r) => sum + r.chunksProcessed, 0)
      }

      return NextResponse.json({
        success: true,
        summary,
        results: Object.fromEntries(results)
      })
    } else if (documentId) {
      // Process single document
      await processDocument(documentId, session.user.id, {
        forceReprocess: force,
        useIncremental
      })

      // Get updated status
      const status = await getDocumentProcessingStatus(documentId, session.user.id)

      return NextResponse.json({
        success: true,
        documentId,
        status
      })
    } else {
      return NextResponse.json({ error: 'Document ID or document IDs required' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing document(s):', error)
    return NextResponse.json(
      { error: 'Failed to process document(s)' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    const status = await getDocumentProcessingStatus(documentId, session.user.id)

    return NextResponse.json({
      success: true,
      documentId,
      status
    })
  } catch (error) {
    console.error('Error getting document status:', error)
    return NextResponse.json(
      { error: 'Failed to get document status' },
      { status: 500 }
    )
  }
}
