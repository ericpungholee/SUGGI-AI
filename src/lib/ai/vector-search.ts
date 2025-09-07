import { prisma } from '@/lib/prisma'
import { createEmbedding, findSimilarChunks, DocumentChunk, cosineSimilarity } from './embeddings'

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
      threshold = 0.1, // Lowered to 0.1 for better retrieval
      includeContent = true
    } = options

    // Use PostgreSQL-based search (Pinecone removed for simplicity)
    console.log('Using PostgreSQL for vector search')
    
    // Generate embedding for the query
    const queryEmbedding = await createEmbedding(query)
    const queryVector = queryEmbedding.embedding

    // Get all document chunks for the user
    console.log('Searching for chunks with userId:', userId)
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
            title: true,
            userId: true
          }
        }
      }
    })
    
    console.log('Found chunks:', chunks.length)
    console.log('Chunk details:', chunks.map(c => ({
      id: c.id,
      documentId: c.documentId,
      documentUserId: c.document.userId,
      hasEmbedding: !!c.embedding
    })))

    // Convert to DocumentChunk format
    const documentChunks: DocumentChunk[] = chunks.map(chunk => ({
      id: chunk.id,
      documentId: chunk.documentId,
      content: chunk.content,
      embedding: chunk.embedding as number[],
      chunkIndex: chunk.chunkIndex
    }))

    // Find similar chunks with similarity scores
    const similarities = documentChunks.map(chunk => ({
      chunk,
      similarity: cosineSimilarity(queryVector, chunk.embedding)
    }))

    const similarChunks = similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    // Convert to search results
    const results: SearchResult[] = similarChunks.map(item => {
      const originalChunk = chunks.find(c => c.id === item.chunk.id)!
      
      return {
        documentId: originalChunk.document.id,
        documentTitle: originalChunk.document.title,
        content: includeContent ? item.chunk.content : '',
        similarity: item.similarity,
        chunkIndex: item.chunk.chunkIndex
      }
    })

    return results
  } catch (error) {
    console.error('Error searching similar documents:', {
      query,
      userId,
      options,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      threshold: 0.1, // Lowered to 0.1 for better retrieval
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
    console.error('Error getting document context:', {
      query,
      userId,
      documentId,
      limit,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
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

    // Delete existing chunks for this document (both in DB and vector DB)
    await prisma.documentChunk.deleteMany({
      where: { documentId }
    })

    // Create new chunks in database
    await prisma.documentChunk.createMany({
      data: chunks.map(chunk => ({
        id: chunk.id,
        documentId: chunk.documentId,
        content: chunk.content,
        embedding: chunk.embedding,
        chunkIndex: chunk.chunkIndex
      }))
    })

    // Using PostgreSQL for vector storage (Pinecone removed for simplicity)
    console.log('Using PostgreSQL for vector storage')

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
    console.error('Error vectorizing document:', {
      documentId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw new Error(`Failed to vectorize document: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
