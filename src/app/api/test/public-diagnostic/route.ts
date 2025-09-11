import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const documentId = 'cmfb894u10003bjx8gj3nqjtg'

    // Get document info (without user check for testing)
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
        isVectorized: true,
        wordCount: true,
        updatedAt: true,
        userId: true
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check content
    const content = document.plainText || (typeof document.content === 'string' 
      ? document.content 
      : document.content?.plainText || '')

    const contentAnalysis = {
      length: content.length,
      wordCount: content.split(/\s+/).length,
      hasNeuroCore: content.includes('NeuroCore X1'),
      hasRTXOrion: content.includes('RTX Orion 5090'),
      hasQuantumVision: content.includes('Quantum Vision Engine'),
      hasAquaTalk: content.includes('AquaTalk 3000'),
      contentPreview: content.substring(0, 300) + '...'
    }

    // Check for document chunks
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      select: {
        id: true,
        chunkIndex: true,
        content: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      document: {
        id: document.id,
        title: document.title,
        userId: document.userId,
        isVectorized: document.isVectorized,
        wordCount: document.wordCount,
        contentLength: content.length,
        lastUpdated: document.updatedAt
      },
      contentAnalysis,
      chunks: {
        count: chunks.length,
        details: chunks.map(chunk => ({
          id: chunk.id,
          chunkIndex: chunk.chunkIndex,
          contentLength: chunk.content?.length || 0,
          createdAt: chunk.createdAt
        }))
      },
      issues: [
        ...(chunks.length > 0 ? [`Found ${chunks.length} document chunks (should be 0 for single vector approach)`] : []),
        ...(!document.isVectorized ? ['Document not marked as vectorized'] : []),
        ...(!contentAnalysis.hasNeuroCore && !contentAnalysis.hasRTXOrion ? ['New fictional content not detected'] : [])
      ]
    })
  } catch (error) {
    console.error('Error in public diagnostic:', error)
    return NextResponse.json(
      { 
        error: 'Public diagnostic failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
