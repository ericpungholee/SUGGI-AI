import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorizeDocumentIncremental } from '@/lib/ai/incremental-vectorization'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    // Get the document
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: session.user.id,
        isDeleted: false
      },
      select: {
        id: true,
        title: true,
        plainText: true,
        content: true,
        isVectorized: true
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Extract content
    const content = document.plainText || (typeof document.content === 'string' 
      ? document.content 
      : document.content?.plainText || '')

    if (!content) {
      return NextResponse.json({ error: 'No content found' }, { status: 400 })
    }

    console.log(`Testing incremental vectorization for document: ${documentId}`)
    console.log(`Content length: ${content.length}`)
    console.log(`Is vectorized: ${document.isVectorized}`)

    // Test incremental vectorization
    const result = await vectorizeDocumentIncremental(documentId, content, false)

    return NextResponse.json({
      success: result.success,
      documentId,
      title: document.title,
      contentLength: content.length,
      result: {
        chunksProcessed: result.chunksProcessed,
        chunksAdded: result.chunksAdded,
        chunksUpdated: result.chunksUpdated,
        chunksDeleted: result.chunksDeleted,
        processingTime: result.processingTime,
        errors: result.errors
      },
      message: result.success ? 'Incremental vectorization completed' : 'Incremental vectorization failed'
    })
  } catch (error) {
    console.error('Error testing incremental vectorization:', error)
    return NextResponse.json(
      { 
        error: 'Incremental vectorization test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
