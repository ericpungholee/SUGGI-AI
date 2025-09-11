import { NextResponse } from 'next/server'
import { processDocument } from '@/lib/ai/document-processor'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { documentId, userId, content, title } = await request.json()

    if (!documentId || !userId) {
      return NextResponse.json({ error: 'Document ID and user ID are required' }, { status: 400 })
    }

    console.log(`Vectorization webhook triggered for document ${documentId}`)

    // Check if document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
        isDeleted: false
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
    }

    // Process the document with vectorization
    await processDocument(documentId, userId, {
      forceReprocess: true, // Force reprocess to ensure latest content
      useIncremental: true
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Document vectorized successfully',
      documentId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in vectorization webhook:', error)
    return NextResponse.json(
      { 
        error: 'Failed to vectorize document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy',
    service: 'vectorization-webhook',
    timestamp: new Date().toISOString()
  })
}
