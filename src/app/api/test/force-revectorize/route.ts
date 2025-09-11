import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorizeDocument } from '@/lib/ai/vector-search'
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

    console.log(`Force re-vectorizing document: ${documentId}`)
    console.log(`Content length: ${content.length}`)
    console.log(`Content preview: ${content.substring(0, 200)}...`)

    // Force re-vectorization
    await vectorizeDocument(documentId, content, session.user.id)

    // Check if it worked
    const updatedDocument = await prisma.document.findFirst({
      where: { id: documentId },
      select: { isVectorized: true, wordCount: true }
    })

    return NextResponse.json({
      success: true,
      documentId,
      title: document.title,
      contentLength: content.length,
      wordCount: content.split(/\s+/).length,
      isVectorized: updatedDocument?.isVectorized,
      message: 'Document force re-vectorized successfully'
    })
  } catch (error) {
    console.error('Error force re-vectorizing document:', error)
    return NextResponse.json(
      { 
        error: 'Force re-vectorization failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
