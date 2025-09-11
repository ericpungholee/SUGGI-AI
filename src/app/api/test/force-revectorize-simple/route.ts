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

    console.log(`Force re-vectorizing document: ${documentId}`)

    // Get the current document content
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
        isVectorized: true,
        wordCount: true
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

    console.log(`Document content length: ${content.length}`)
    console.log(`Word count: ${document.wordCount}`)
    console.log(`Is vectorized: ${document.isVectorized}`)
    console.log(`Content preview: ${content.substring(0, 200)}...`)

    // Check if content contains the new fictional content
    const hasNeuroCore = content.includes('NeuroCore X1')
    const hasRTXOrion = content.includes('RTX Orion 5090')
    const hasQuantumVision = content.includes('Quantum Vision Engine')
    
    console.log(`Content analysis:`)
    console.log(`- Has NeuroCore X1: ${hasNeuroCore}`)
    console.log(`- Has RTX Orion 5090: ${hasRTXOrion}`)
    console.log(`- Has Quantum Vision Engine: ${hasQuantumVision}`)

    // Force re-vectorization
    await vectorizeDocument(documentId, content, session.user.id)

    // Verify it worked
    const updatedDocument = await prisma.document.findFirst({
      where: { id: documentId },
      select: { isVectorized: true, wordCount: true }
    })

    return NextResponse.json({
      success: true,
      documentId,
      title: document.title,
      contentLength: content.length,
      wordCount: document.wordCount,
      isVectorized: updatedDocument?.isVectorized,
      contentAnalysis: {
        hasNeuroCore,
        hasRTXOrion,
        hasQuantumVision
      },
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
