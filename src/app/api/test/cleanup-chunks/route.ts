import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { vectorizeDocument } from '@/lib/ai/vector-search'

export async function POST(request: NextRequest) {
  try {
    const documentId = 'cmfb894u10003bjx8gj3nqjtg'

    console.log(`Cleaning up chunks for document: ${documentId}`)

    // 1. Get the current document
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        isDeleted: false
      },
      select: {
        id: true,
        title: true,
        plainText: true,
        content: true,
        userId: true
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // 2. Count existing chunks
    const existingChunks = await prisma.documentChunk.count({
      where: { documentId }
    })

    console.log(`Found ${existingChunks} existing chunks`)

    // 3. Delete all existing chunks
    const deleteResult = await prisma.documentChunk.deleteMany({
      where: { documentId }
    })

    console.log(`Deleted ${deleteResult.count} chunks`)

    // 4. Extract content
    const content = document.plainText || (typeof document.content === 'string' 
      ? document.content 
      : document.content?.plainText || '')

    if (!content) {
      return NextResponse.json({ error: 'No content found' }, { status: 400 })
    }

    // 5. Re-vectorize with single vector approach
    console.log(`Re-vectorizing document with single vector approach`)
    await vectorizeDocument(documentId, content, document.userId)

    // 6. Verify cleanup
    const remainingChunks = await prisma.documentChunk.count({
      where: { documentId }
    })

    const updatedDocument = await prisma.document.findFirst({
      where: { id: documentId },
      select: {
        isVectorized: true,
        wordCount: true,
        embedding: true
      }
    })

    return NextResponse.json({
      success: true,
      documentId,
      cleanup: {
        chunksBefore: existingChunks,
        chunksDeleted: deleteResult.count,
        chunksRemaining: remainingChunks
      },
      vectorization: {
        isVectorized: updatedDocument?.isVectorized,
        wordCount: updatedDocument?.wordCount,
        hasEmbedding: !!updatedDocument?.embedding,
        embeddingDimensions: updatedDocument?.embedding?.length || 0
      },
      message: 'Chunks cleaned up and document re-vectorized with single vector approach'
    })
  } catch (error) {
    console.error('Error cleaning up chunks:', error)
    return NextResponse.json(
      { 
        error: 'Chunk cleanup failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
