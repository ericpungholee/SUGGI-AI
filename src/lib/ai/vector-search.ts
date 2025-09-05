import { prisma } from '@/lib/prisma'
import { createEmbedding, findSimilarChunks, DocumentChunk } from './embeddings'

export interface SearchResult {
  documentId: string
  documentTitle: string
  content: string
  similarity: number
  chunkIndex: number
}

export interface DocumentSearchOptions {
  limit?: number
  threshold?: number
  includeContent?: boolean
}

/**
 * Search for similar documents using vector similarity
 */
export async function searchSimilarDocuments(
  query: string,
  userId: string,
  options: DocumentSearchOptions = {}
): Promise<SearchResult[]> {
  try {
    const {
      limit = 10,
      threshold = 0.7,
      includeContent = true
    } = options

    // Generate embedding for the query
    const queryEmbedding = await createEmbedding(query)
    const queryVector = queryEmbedding.embedding

    // Get all document chunks for the user
    const chunks = await prisma.documentChunk.findMany({
      where: {
        document: {
          userId,
          isDeleted: false
        }
      },
      include: {
        document: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })

    // Convert to DocumentChunk format
    const documentChunks: DocumentChunk[] = chunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      embedding: chunk.embedding as number[],
      chunkIndex: chunk.chunkIndex
    }))

    // Find similar chunks
    const similarChunks = findSimilarChunks(
      queryVector,
      documentChunks,
      limit,
      threshold
    )

    // Convert to search results
    const results: SearchResult[] = similarChunks.map(chunk => {
      const originalChunk = chunks.find(c => c.id === chunk.id)!
      
      return {
        documentId: originalChunk.document.id,
        documentTitle: originalChunk.document.title,
        content: includeContent ? chunk.content : '',
        similarity: 0, // Will be calculated in findSimilarChunks
        chunkIndex: chunk.chunkIndex
      }
    })

    return results
  } catch (error) {
    console.error('Error searching similar documents:', error)
    throw new Error('Failed to search documents')
  }
}

/**
 * Get document context for AI chat
 */
export async function getDocumentContext(
  query: string,
  userId: string,
  documentId?: string,
  limit: number = 5
): Promise<string> {
  try {
    const searchResults = await searchSimilarDocuments(query, userId, {
      limit,
      threshold: 0.6,
      includeContent: true
    })

    // Filter by specific document if provided
    const relevantResults = documentId 
      ? searchResults.filter(result => result.documentId === documentId)
      : searchResults

    if (relevantResults.length === 0) {
      return ''
    }

    // Format context
    const context = relevantResults
      .map((result, index) => {
        const content = result.content.length > 200 
          ? result.content.substring(0, 200) + '...'
          : result.content
        
        return `[${index + 1}] From "${result.documentTitle}":\n${content}`
      })
      .join('\n\n')

    return context
  } catch (error) {
    console.error('Error getting document context:', error)
    return ''
  }
}

/**
 * Vectorize a document and store chunks
 */
export async function vectorizeDocument(
  documentId: string,
  content: string,
  userId: string
): Promise<void> {
  try {
    // Check if document belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
        isDeleted: false
      }
    })

    if (!document) {
      throw new Error('Document not found or access denied')
    }

    // Process document content into chunks
    const { processDocumentContent } = await import('./embeddings')
    const chunks = await processDocumentContent(content, documentId)

    if (chunks.length === 0) {
      return
    }

    // Delete existing chunks for this document
    await prisma.documentChunk.deleteMany({
      where: { documentId }
    })

    // Create new chunks
    await prisma.documentChunk.createMany({
      data: chunks.map(chunk => ({
        id: chunk.id,
        documentId: chunk.documentId,
        content: chunk.content,
        embedding: chunk.embedding,
        chunkIndex: chunk.chunkIndex
      }))
    })

    // Update document as vectorized
    await prisma.document.update({
      where: { id: documentId },
      data: {
        isVectorized: true,
        embedding: chunks[0].embedding // Store first chunk embedding for quick access
      }
    })

    console.log(`Document ${documentId} vectorized with ${chunks.length} chunks`)
  } catch (error) {
    console.error('Error vectorizing document:', error)
    throw new Error('Failed to vectorize document')
  }
}

/**
 * Get document statistics
 */
export async function getDocumentStats(userId: string): Promise<{
  totalDocuments: number
  vectorizedDocuments: number
  totalChunks: number
}> {
  try {
    const [totalDocuments, vectorizedDocuments, totalChunks] = await Promise.all([
      prisma.document.count({
        where: { userId, isDeleted: false }
      }),
      prisma.document.count({
        where: { userId, isDeleted: false, isVectorized: true }
      }),
      prisma.documentChunk.count({
        where: {
          document: {
            userId,
            isDeleted: false
          }
        }
      })
    ])

    return {
      totalDocuments,
      vectorizedDocuments,
      totalChunks
    }
  } catch (error) {
    console.error('Error getting document stats:', error)
    throw new Error('Failed to get document statistics')
  }
}
