import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorDB } from '@/lib/ai/vector-db'
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

    console.log(`Starting vector audit for document: ${documentId}`)

    // 1. Check document in database
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
        wordCount: true,
        embedding: true,
        updatedAt: true
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // 2. Initialize Pinecone and check vectors
    await vectorDB.initialize()
    
    // 3. Search for vectors in Pinecone
    const searchResults = await vectorDB.searchDocuments(
      document.title, // Use document title as search query
      session.user.id,
      {
        limit: 10,
        threshold: 0.1,
        includeContent: true
      }
    )

    // 4. Check for duplicates by searching with document ID
    const duplicateResults = await vectorDB.searchDocuments(
      `document:${documentId}`,
      session.user.id,
      {
        limit: 10,
        threshold: 0.1,
        includeContent: true
      }
    )

    // 5. Check document chunks (if any exist)
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      select: {
        id: true,
        chunkIndex: true,
        content: true,
        embedding: true,
        createdAt: true
      }
    })

    // 6. Analyze content
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
      contentPreview: content.substring(0, 500) + '...'
    }

    // 7. Check embedding dimensions
    const embeddingDimensions = document.embedding ? document.embedding.length : 0
    const expectedDimensions = 1536

    const audit = {
      documentId,
      timestamp: new Date().toISOString(),
      database: {
        exists: true,
        title: document.title,
        isVectorized: document.isVectorized,
        wordCount: document.wordCount,
        embeddingDimensions,
        expectedDimensions,
        hasEmbedding: !!document.embedding,
        lastUpdated: document.updatedAt
      },
      content: contentAnalysis,
      pinecone: {
        searchResults: searchResults.length,
        duplicateResults: duplicateResults.length,
        searchDetails: searchResults.map(result => ({
          id: result.id,
          score: result.score,
          contentPreview: result.content?.substring(0, 100) + '...',
          metadata: result.metadata
        })),
        duplicates: duplicateResults.map(result => ({
          id: result.id,
          score: result.score,
          contentPreview: result.content?.substring(0, 100) + '...',
          metadata: result.metadata
        }))
      },
      chunks: {
        count: chunks.length,
        details: chunks.map(chunk => ({
          id: chunk.id,
          chunkIndex: chunk.chunkIndex,
          contentLength: chunk.content?.length || 0,
          hasEmbedding: !!chunk.embedding,
          createdAt: chunk.createdAt
        }))
      },
      issues: []
    }

    // Identify issues
    if (!document.isVectorized) {
      audit.issues.push('Document not marked as vectorized')
    }
    if (!document.embedding) {
      audit.issues.push('No embedding stored in database')
    }
    if (embeddingDimensions !== expectedDimensions) {
      audit.issues.push(`Embedding dimension mismatch: ${embeddingDimensions} vs ${expectedDimensions}`)
    }
    if (searchResults.length === 0) {
      audit.issues.push('No vectors found in Pinecone for this document')
    }
    if (duplicateResults.length > 1) {
      audit.issues.push(`Found ${duplicateResults.length} duplicate vectors in Pinecone`)
    }
    if (chunks.length > 0) {
      audit.issues.push(`Found ${chunks.length} document chunks (should be 0 for single vector approach)`)
    }
    if (!contentAnalysis.hasNeuroCore && !contentAnalysis.hasRTXOrion) {
      audit.issues.push('New fictional content not detected in document')
    }

    console.log(`Vector audit completed for document ${documentId}`)
    console.log(`Issues found: ${audit.issues.length}`)
    console.log(`Pinecone results: ${searchResults.length}`)
    console.log(`Content length: ${content.length}`)

    return NextResponse.json(audit)
  } catch (error) {
    console.error('Error in vector audit:', error)
    return NextResponse.json(
      { 
        error: 'Vector audit failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
