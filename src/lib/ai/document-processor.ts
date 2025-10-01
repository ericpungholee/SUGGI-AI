import { prisma } from '@/lib/prisma'
import { vectorizeDocument } from './vector-search'
import { vectorizeDocumentIncremental, getVectorizationStatus } from './incremental-vectorization'

export interface DocumentProcessingOptions {
  forceReprocess?: boolean
  batchSize?: number
  useIncremental?: boolean
}

/**
 * Process a single document for AI features
 */
export async function processDocument(
  documentId: string,
  userId: string,
  options: DocumentProcessingOptions = {}
): Promise<void> {
  try {
    const { forceReprocess = false, useIncremental = true } = options

    // Get document
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
        isDeleted: false
      },
      select: {
        id: true,
        title: true,
        content: true,
        plainText: true,
        isVectorized: true
      }
    })

    if (!document) {
      throw new Error('Document not found or access denied')
    }

    // Use plainText if available, otherwise extract from content
    const content = document.plainText || extractTextFromContent(document.content)

    if (!content || content.trim().length === 0) {
      return
    }

    // Use incremental vectorization by default for efficiency
    if (useIncremental) {
      const result = await vectorizeDocumentIncremental(documentId, content, forceReprocess)
      
      if (!result.success) {
        console.error(`Incremental vectorization failed for document ${documentId}:`, result.errors)
        // Fallback to full vectorization
        await vectorizeDocument(documentId, content, userId)
      }
    } else {
      // Use traditional full vectorization
      await vectorizeDocument(documentId, content, userId)
    }
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error)
    throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Process multiple documents in batch
 */
export async function processDocuments(
  documentIds: string[],
  userId: string,
  options: DocumentProcessingOptions = {}
): Promise<{ processed: number; failed: number; errors: string[] }> {
  const { batchSize = 5 } = options
  let processed = 0
  let failed = 0
  const errors: string[] = []

  // Process documents in batches
  for (let i = 0; i < documentIds.length; i += batchSize) {
    const batch = documentIds.slice(i, i + batchSize)
    
    const promises = batch.map(async (documentId) => {
      try {
        await processDocument(documentId, userId, options)
        processed++
      } catch (error) {
        failed++
        const errorMessage = `Document ${documentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMessage)
        console.error(errorMessage)
      }
    })

    await Promise.all(promises)
  }

  return { processed, failed, errors }
}

/**
 * Process all documents for a user
 */
export async function processAllUserDocuments(
  userId: string,
  options: DocumentProcessingOptions = {}
): Promise<{ processed: number; failed: number; errors: string[] }> {
  try {
    // Get all documents for the user
    const documents = await prisma.document.findMany({
      where: {
        userId,
        isDeleted: false
      },
      select: {
        id: true
      }
    })

    const documentIds = documents.map(doc => doc.id)
    
    return await processDocuments(documentIds, userId, options)
  } catch (error) {
    console.error('Error processing all user documents:', error)
    throw new Error('Failed to process all documents')
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
    // Handle different content structures
    if (content.html) {
      return stripHtml(content.html)
    }
    
    if (content.plainText) {
      return content.plainText
    }

    if (content.text) {
      return content.text
    }

    // If it's an array of content blocks
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

    // Try to extract text from any nested structure
    return JSON.stringify(content)
  }

  return ''
}

/**
 * Strip HTML tags from text, excluding image data
 */
function stripHtml(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, ' ') // Remove img tags and their content
    .replace(/<[^>]*>/g, ' ') // Remove remaining HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Get processing status for a document
 */
export async function getDocumentProcessingStatus(
  documentId: string,
  userId: string
): Promise<{
  isProcessed: boolean
  chunkCount: number
  lastProcessed?: Date
  needsUpdate: boolean
}> {
  try {
    // Verify document access
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
        isDeleted: false
      },
      select: {
        id: true
      }
    })

    if (!document) {
      throw new Error('Document not found or access denied')
    }

    // Get detailed vectorization status
    const status = await getVectorizationStatus(documentId)

    return {
      isProcessed: status.isVectorized,
      chunkCount: status.chunksCount,
      lastProcessed: status.lastVectorized,
      needsUpdate: !status.needsUpdate
    }
  } catch (error) {
    console.error('Error getting document processing status:', error)
    throw new Error('Failed to get document processing status')
  }
}

/**
 * Clean up orphaned chunks
 */
export async function cleanupOrphanedChunks(): Promise<number> {
  try {
    // Find chunks that belong to deleted documents
    const result = await prisma.documentChunk.deleteMany({
      where: {
        document: {
          isDeleted: true
        }
      }
    })

    return result.count
  } catch (error) {
    console.error('Error cleaning up orphaned chunks:', error)
    throw new Error('Failed to cleanup orphaned chunks')
  }
}
