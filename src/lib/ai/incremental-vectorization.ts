import { prisma } from '@/lib/prisma'
import { createEmbedding } from './embeddings'

export interface VectorizationResult {
  success: boolean
  chunksProcessed: number
  chunksAdded: number
  chunksUpdated: number
  chunksDeleted: number
  processingTime: number
  errors: string[]
}

/**
 * Efficiently vectorize document with incremental updates
 */
export async function vectorizeDocumentIncremental(
  documentId: string,
  content: string,
  force: boolean = false
): Promise<VectorizationResult> {
  const startTime = Date.now()
  
  const result: VectorizationResult = {
    success: false,
    chunksProcessed: 0,
    chunksAdded: 0,
    chunksUpdated: 0,
    chunksDeleted: 0,
    processingTime: 0,
    errors: []
  }

  try {
    // Check if re-vectorization is needed
    if (!force && !(await needsRevectorization(documentId, content))) {
      result.success = true
      result.processingTime = Date.now() - startTime
      return result
    }

    // Get document info
    const document = await prisma.document.findFirst({
      where: { id: documentId },
      select: { title: true, userId: true, plainText: true }
    })

    if (!document) {
      result.errors.push('Document not found')
      result.processingTime = Date.now() - startTime
      return result
    }

    // Generate embedding for the entire document
    const embedding = await createEmbedding(content)

    // Update the single document vector in Pinecone
    const { vectorDB } = await import('./vector-db')
    const vectorDocument = {
      id: documentId, // Use document ID as the vector ID
      content: content,
      metadata: {
        documentId: documentId,
        documentTitle: document.title,
        userId: document.userId,
        chunkIndex: 0, // Single document = chunk 0
        createdAt: new Date().toISOString(),
        contentType: 'text',
        documentType: 'document',
        wordCount: content.split(/\s+/).length
      }
    }

    await vectorDB.upsertDocuments([vectorDocument])

    // Update document in database
    await prisma.document.update({
      where: { id: documentId },
      data: {
        plainText: content,
        embedding: embedding.embedding,
        wordCount: content.split(/\s+/).length,
        isVectorized: true
      }
    })

    // Clean up any existing chunks (we're using single vector now)
    await prisma.documentChunk.deleteMany({
      where: { documentId }
    })

    result.chunksUpdated++
    result.chunksProcessed++
    result.success = true
    result.processingTime = Date.now() - startTime

    // Incremental vectorization completed

    return result
  } catch (error) {
    const errorMsg = `Vectorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(errorMsg)
    result.errors.push(errorMsg)
    result.processingTime = Date.now() - startTime
    return result
  }
}

/**
 * Simple check if re-vectorization is needed
 */
async function needsRevectorization(documentId: string, content: string): Promise<boolean> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { plainText: true, isVectorized: true }
    })

    if (!document) return true
    if (!document.isVectorized) return true
    
    // Simple content comparison
    const currentContent = document.plainText || ''
    return currentContent !== content
  } catch (error) {
    console.error('Error checking if re-vectorization needed:', error)
    return true // Default to re-vectorizing if check fails
  }
}

/**
 * Get vectorization status for a document
 */
export async function getVectorizationStatus(documentId: string): Promise<{
  isVectorized: boolean
  chunksCount: number
  lastVectorized?: Date
  needsUpdate: boolean
}> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      chunks: true,
      versions: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!document) {
    throw new Error('Document not found')
  }

  const chunksCount = document.chunks.length
  const lastVectorized = document.versions[0]?.vectorizedAt
  const needsUpdate = !(await needsRevectorization(documentId, document.plainText || ''))

  return {
    isVectorized: document.isVectorized,
    chunksCount,
    lastVectorized,
    needsUpdate
  }
}

/**
 * Batch vectorize multiple documents efficiently
 */
export async function batchVectorizeDocuments(
  documentIds: string[],
  force: boolean = false
): Promise<Map<string, VectorizationResult>> {
  const results = new Map<string, VectorizationResult>()
  
  // Process documents in parallel with concurrency limit
  const concurrencyLimit = 3
  const chunks = []
  
  for (let i = 0; i < documentIds.length; i += concurrencyLimit) {
    chunks.push(documentIds.slice(i, i + concurrencyLimit))
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (documentId) => {
      try {
        const document = await prisma.document.findUnique({
          where: { id: documentId }
        })
        
        if (!document) {
          return [documentId, {
            success: false,
            chunksProcessed: 0,
            chunksAdded: 0,
            chunksUpdated: 0,
            chunksDeleted: 0,
            processingTime: 0,
            errors: ['Document not found']
          }]
        }

        const result = await vectorizeDocumentIncremental(
          documentId,
          document.plainText || '',
          force
        )
        
        return [documentId, result]
      } catch (error) {
        return [documentId, {
          success: false,
          chunksProcessed: 0,
          chunksAdded: 0,
          chunksUpdated: 0,
          chunksDeleted: 0,
          processingTime: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        }]
      }
    })

    const chunkResults = await Promise.all(promises)
    chunkResults.forEach(([id, result]) => {
      results.set(id as string, result as VectorizationResult)
    })
  }

  return results
}