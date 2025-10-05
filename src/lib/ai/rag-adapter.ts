import { vectorDB } from './vector-db'
import type { VectorSearchResult } from './vector-db'
import { createEmbedding } from './embeddings'
import { DocumentChunk } from './embeddings'

export type RagChunk = {
  id: string
  docId: string
  anchor: string
  text: string
  score: number
  headings: string[]
  updatedAt: string
  tokens: number
}

export interface RAGAdapter {
  // Dense + BM25 + RRF + MMR under the hood (your current pipeline)
  search(q: string, opts?: { topK?: number; projectId?: string }): Promise<RagChunk[]>
  expandHierarchy(chunks: RagChunk[], neighbors?: number, parents?: boolean): Promise<RagChunk[]>
  packContext(chunks: RagChunk[], budgetTokens: number): Promise<RagChunk[]>
  // Optional: normalization to [0,1] for gating
  confidence(chunks: RagChunk[]): number
}

class RAGAdapterImpl implements RAGAdapter {
  /**
   * Search for relevant chunks using the existing vector search pipeline
   */
  async search(q: string, opts: { topK?: number; projectId?: string } = {}): Promise<RagChunk[]> {
    try {
      const { topK = 30, projectId } = opts
      
      // Use the existing vector database search
      const results = await vectorDB.searchDocuments(q, projectId || '', {
        topK,
        includeMetadata: true,
        searchStrategy: 'semantic',
        useHybridSearch: true,
        threshold: 0.1
      })

      // Convert to RagChunk format
      const ragChunks: RagChunk[] = results.map((result: VectorSearchResult) => ({
        id: result.id,
        docId: result.metadata.documentId,
        anchor: `doc#p${result.metadata.chunkIndex}`,
        text: result.content,
        score: result.score,
        headings: this.extractHeadings(result.content),
        updatedAt: result.metadata.createdAt,
        tokens: Math.ceil(result.content.length / 4) // Rough token estimation
      }))

      return ragChunks
    } catch (error) {
      console.error('Error in RAGAdapter search:', error)
      throw new Error(`RAG search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Expand hierarchy by getting neighboring chunks and parent sections
   */
  async expandHierarchy(chunks: RagChunk[], neighbors: number = 1, parents: boolean = true): Promise<RagChunk[]> {
    try {
      const expandedChunks = new Map<string, RagChunk>()
      
      // Add original chunks
      chunks.forEach(chunk => expandedChunks.set(chunk.id, chunk))

      // Get neighbors for each chunk
      if (neighbors > 0) {
        for (const chunk of chunks) {
          // Get chunks from the same document with similar indices
          const docChunks = await this.getDocumentChunks(chunk.docId, chunk.id)
          
          // Add neighboring chunks
          docChunks.forEach(neighbor => {
            if (!expandedChunks.has(neighbor.id)) {
              expandedChunks.set(neighbor.id, neighbor)
            }
          })
        }
      }

      // Get parent sections if requested
      if (parents) {
        for (const chunk of chunks) {
          const parentChunks = await this.getParentChunks(chunk)
          parentChunks.forEach(parent => {
            if (!expandedChunks.has(parent.id)) {
              expandedChunks.set(parent.id, parent)
            }
          })
        }
      }

      return Array.from(expandedChunks.values())
    } catch (error) {
      console.error('Error expanding hierarchy:', error)
      return chunks // Return original chunks if expansion fails
    }
  }

  /**
   * Pack context within token budget, prioritizing high-scoring chunks
   */
  async packContext(chunks: RagChunk[], budgetTokens: number): Promise<RagChunk[]> {
    // Sort by score descending
    const sortedChunks = [...chunks].sort((a, b) => b.score - a.score)
    
    const packedChunks: RagChunk[] = []
    let currentTokens = 0

    for (const chunk of sortedChunks) {
      if (currentTokens + chunk.tokens <= budgetTokens) {
        packedChunks.push(chunk)
        currentTokens += chunk.tokens
      } else {
        // If we can't fit the whole chunk, try to fit a portion
        const remainingTokens = budgetTokens - currentTokens
        if (remainingTokens > 100) { // Only add if we have meaningful space
          const truncatedChunk = {
            ...chunk,
            text: this.truncateText(chunk.text, remainingTokens),
            tokens: remainingTokens
          }
          packedChunks.push(truncatedChunk)
          currentTokens += remainingTokens
        }
        break
      }
    }

    return packedChunks
  }

  /**
   * Calculate confidence score based on chunk quality and relevance
   */
  confidence(chunks: RagChunk[]): number {
    if (chunks.length === 0) return 0

    // Calculate mean and max scores
    const scores = chunks.map(c => c.score)
    const meanScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const maxScore = Math.max(...scores)

    // Normalize to [0, 1] range
    // Higher confidence for higher mean scores and when we have good max scores
    const confidence = Math.min(1, (meanScore * 0.7 + maxScore * 0.3))
    
    return confidence
  }

  /**
   * Extract headings from chunk content
   */
  private extractHeadings(content: string): string[] {
    const headings: string[] = []
    
    // Extract markdown headers
    const headerMatches = content.match(/^#{1,6}\s+(.+)$/gm)
    if (headerMatches) {
      headings.push(...headerMatches.map(h => h.replace(/^#+\s+/, '').trim()))
    }

    // Extract other structural elements
    const sectionMatches = content.match(/^[A-Z][^.!?]*[.!?]$/gm)
    if (sectionMatches && headings.length === 0) {
      headings.push(...sectionMatches.slice(0, 3)) // Take first 3 sentences as context
    }

    return headings.slice(0, 5) // Limit to 5 headings
  }

  /**
   * Get chunks from the same document
   */
  private async getDocumentChunks(docId: string, currentChunkId: string): Promise<RagChunk[]> {
    try {
      // This would typically query the document chunks from the database
      // For now, return empty array as we're using single document vectors
      return []
    } catch (error) {
      console.error('Error getting document chunks:', error)
      return []
    }
  }

  /**
   * Get parent chunks (sections that contain this chunk)
   */
  private async getParentChunks(chunk: RagChunk): Promise<RagChunk[]> {
    try {
      // This would typically find parent sections
      // For now, return empty array
      return []
    } catch (error) {
      console.error('Error getting parent chunks:', error)
      return []
    }
  }

  /**
   * Truncate text to fit within token budget
   */
  private truncateText(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4 // Rough conversion
    if (text.length <= maxChars) return text
    
    // Try to truncate at sentence boundary
    const truncated = text.substring(0, maxChars)
    const lastSentenceEnd = truncated.lastIndexOf('.')
    
    if (lastSentenceEnd > maxChars * 0.7) {
      return truncated.substring(0, lastSentenceEnd + 1)
    }
    
    return truncated + '...'
  }
}

// Export singleton instance
export const ragAdapter = new RAGAdapterImpl()

// Helper function to calculate coverage
export function uniqueSectionCount(chunks: RagChunk[]): number {
  const uniqueSections = new Set(chunks.map(c => c.docId))
  return uniqueSections.size
}

// Helper function to build evidence bundle
export function buildEvidenceBundle(ragChunks: RagChunk[], webResults: any[] = []): {
  rag: RagChunk[]
  web: any[]
  totalTokens: number
} {
  const ragTokens = ragChunks.reduce((sum, chunk) => sum + chunk.tokens, 0)
  const webTokens = webResults.reduce((sum, result) => sum + (result.tokens || 100), 0)
  
  return {
    rag: ragChunks,
    web: webResults,
    totalTokens: ragTokens + webTokens
  }
}
