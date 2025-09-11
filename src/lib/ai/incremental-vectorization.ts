import { prisma } from '@/lib/prisma'
import { chunkTextAdaptive, createEmbedding } from './embeddings'
import { trackDocumentChanges, saveDocumentVersion, needsRevectorization } from './document-change-tracker'
import { DocumentChange } from './document-change-tracker'
import { performanceMonitor } from './performance-monitor'

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
  const operationId = performanceMonitor.startOperation('incremental-vectorization', documentId)
  
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
      console.log(`Document ${documentId} is already up to date, skipping vectorization`)
      result.success = true
      result.processingTime = Date.now() - startTime
      return result
    }

    // Track changes
    const changes = await trackDocumentChanges(documentId, content)
    console.log(`Found ${changes.length} changes for document ${documentId}`)

    if (changes.length === 0) {
      // No changes detected, but mark as vectorized
      await prisma.document.update({
        where: { id: documentId },
        data: { isVectorized: true }
      })
      result.success = true
      result.processingTime = Date.now() - startTime
      return result
    }

    // Process changes incrementally
    for (const change of changes) {
      try {
        await processDocumentChange(documentId, change, result)
      } catch (error) {
        const errorMsg = `Error processing change: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        result.errors.push(errorMsg)
      }
    }

    // If we have errors but processed some chunks, still mark as vectorized
    if (result.chunksProcessed > 0) {
      await prisma.document.update({
        where: { id: documentId },
        data: { isVectorized: true }
      })
    }

    // Save document version
    const totalChunks = await prisma.documentChunk.count({
      where: { documentId }
    })
    
    await saveDocumentVersion(documentId, content, totalChunks)

    result.success = result.errors.length === 0 || result.chunksProcessed > 0
    result.processingTime = Date.now() - startTime

    // End performance monitoring
    performanceMonitor.endOperation(operationId, {
      chunksProcessed: result.chunksProcessed,
      chunksAdded: result.chunksAdded,
      chunksUpdated: result.chunksUpdated,
      chunksDeleted: result.chunksDeleted,
      error: result.errors.length > 0 ? result.errors.join('; ') : undefined
    })

    console.log(`Incremental vectorization completed for document ${documentId}:`, {
      chunksProcessed: result.chunksProcessed,
      chunksAdded: result.chunksAdded,
      chunksUpdated: result.chunksUpdated,
      chunksDeleted: result.chunksDeleted,
      processingTime: result.processingTime,
      errors: result.errors.length
    })

    return result
  } catch (error) {
    const errorMsg = `Vectorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(errorMsg)
    result.errors.push(errorMsg)
    result.processingTime = Date.now() - startTime
    
    // End performance monitoring with error
    performanceMonitor.endOperation(operationId, {
      chunksProcessed: 0,
      chunksAdded: 0,
      chunksUpdated: 0,
      chunksDeleted: 0,
      error: errorMsg
    })
    
    return result
  }
}

/**
 * Process individual document changes
 */
async function processDocumentChange(
  documentId: string,
  change: DocumentChange,
  result: VectorizationResult
): Promise<void> {
  switch (change.type) {
    case 'added':
      await handleAddedContent(documentId, change, result)
      break
    case 'modified':
      await handleModifiedContent(documentId, change, result)
      break
    case 'deleted':
      await handleDeletedContent(documentId, change, result)
      break
  }
}

/**
 * Handle added content - update the single document vector
 */
async function handleAddedContent(
  documentId: string,
  change: DocumentChange,
  result: VectorizationResult
): Promise<void> {
  if (!change.newContent) return

  try {
    // Get the current document content
    const document = await prisma.document.findFirst({
      where: { id: documentId },
      select: { plainText: true, content: true, title: true, userId: true }
    })

    if (!document) {
      result.errors.push('Document not found for content update')
      return
    }

    // For single vector approach, we need to re-vectorize the entire document
    // The newContent passed here should be the full updated content
    const fullContent = change.newContent || (document.plainText || extractTextFromContent(document.content))
    
    console.log(`Re-vectorizing document ${documentId} with full content (length: ${fullContent.length})`)

    // Generate new embedding for the entire document
    const embedding = await createEmbedding(fullContent)

    // Update the single document vector in Pinecone
    const { vectorDB } = await import('./vector-db')
    const vectorDocument = {
      id: documentId, // Use document ID as the vector ID
      content: fullContent,
      metadata: {
        documentId: documentId,
        documentTitle: document.title,
        userId: document.userId,
        chunkIndex: 0, // Single document = chunk 0
        createdAt: new Date().toISOString(),
        contentType: 'text',
        documentType: 'document',
        wordCount: fullContent.split(/\s+/).length
      }
    }

    await vectorDB.upsertDocuments([vectorDocument])
    console.log(`Updated single vector for document ${documentId} in Pinecone`)

    // Update document in database
    await prisma.document.update({
      where: { id: documentId },
      data: {
        plainText: fullContent,
        embedding: embedding.embedding,
        wordCount: fullContent.split(/\s+/).length,
        isVectorized: true
      }
    })

    result.chunksUpdated++
    result.chunksProcessed++
  } catch (error) {
    console.error(`Error updating document vector for added content:`, error)
    result.errors.push(`Failed to update document vector: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract text content from document JSON content
 */
function extractTextFromContent(content: any): string {
  if (typeof content === 'string') {
    return content
  }

  if (typeof content === 'object' && content !== null) {
    if (content.html) {
      return stripHtml(content.html)
    }
    
    if (content.plainText) {
      return content.plainText
    }

    if (content.text) {
      return content.text
    }

    if (Array.isArray(content)) {
      return content
        .map(block => {
          if (typeof block === 'string') return block
          if (block.text) return block.text
          if (block.content) return block.content
          return ''
        })
        .join('\n')
    }

    return JSON.stringify(content)
  }

  return ''
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Handle modified content - update the single document vector
 */
async function handleModifiedContent(
  documentId: string,
  change: DocumentChange,
  result: VectorizationResult
): Promise<void> {
  if (!change.newContent) return

  // For modified content, we'll re-vectorize the entire document
  await revectorizeDocument(documentId, change.newContent, result)
}

/**
 * Handle deleted content - remove affected chunks
 */
async function handleDeletedContent(
  documentId: string,
  change: DocumentChange,
  result: VectorizationResult
): Promise<void> {
  // Find chunks that are affected by the deletion
  const affectedChunks = await prisma.documentChunk.findMany({
    where: { documentId },
    orderBy: { chunkIndex: 'asc' }
  })

  // For simplicity, if content is deleted, we'll re-chunk the entire document
  // In a more sophisticated implementation, we could identify specific chunks to delete
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  })

  if (document) {
    await revectorizeDocument(documentId, document.plainText || '', result)
  }
}

/**
 * Re-vectorize entire document (fallback for complex changes)
 */
async function revectorizeDocument(
  documentId: string,
  content: string,
  result: VectorizationResult
): Promise<void> {
  try {
    // Get document info
    const document = await prisma.document.findFirst({
      where: { id: documentId },
      select: { title: true, userId: true }
    })

    if (!document) {
      result.errors.push('Document not found for re-vectorization')
      return
    }

    // Generate single embedding for the entire document
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
    console.log(`Re-vectorized single vector for document ${documentId} in Pinecone`)

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
  } catch (error) {
    console.error(`Error re-vectorizing document:`, error)
    result.errors.push(`Failed to re-vectorize document: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
