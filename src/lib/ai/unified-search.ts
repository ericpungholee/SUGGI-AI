/**
 * Unified Search Service
 * Consolidates all search functionality into a single, consistent interface
 */

import { prisma } from '@/lib/prisma'
import { 
  searchSimilarDocuments as vectorSearch,
  SearchResult as VectorSearchResultType,
  DocumentSearchOptions as VectorSearchOptionsType
} from './vector-search'
import { 
  searchDocumentsInVectorDB
} from './vector-db'
import type { 
  VectorSearchResult as VectorDBSearchResult,
  VectorSearchOptions as VectorDBOptions
} from './vector-db'
import { 
  ragAdapter,
  RagChunk
} from './rag-adapter'

export interface UnifiedSearchOptions {
  // Search type
  searchType?: 'text' | 'vector' | 'hybrid' | 'rag'
  
  // Common options
  limit?: number
  threshold?: number
  includeContent?: boolean
  
  // Vector-specific options
  useHybridSearch?: boolean
  useQueryExpansion?: boolean
  useQueryRewriting?: boolean
  searchStrategy?: 'semantic' | 'hybrid' | 'keyword' | 'adaptive'
  
  // RAG-specific options
  topK?: number
  projectId?: string
  
  // Text search options
  searchFields?: string[]
  
  // Common filters
  userId?: string
  documentIds?: string[]
  isDeleted?: boolean
  
  // Performance options
  abortSignal?: AbortSignal
  timeout?: number
}

export interface UnifiedSearchResult {
  id: string
  type: 'document' | 'folder' | 'chunk'
  title: string
  content: string
  preview: string
  similarity?: number
  score?: number
  metadata: {
    documentId?: string
    folderId?: string
    chunkIndex?: number
    wordCount?: number
    isStarred?: boolean
    updatedAt: Date
    source: 'text' | 'vector' | 'rag'
  }
}

export class UnifiedSearchService {
  private static instance: UnifiedSearchService

  static getInstance(): UnifiedSearchService {
    if (!UnifiedSearchService.instance) {
      UnifiedSearchService.instance = new UnifiedSearchService()
    }
    return UnifiedSearchService.instance
  }

  /**
   * Perform unified search across all available search methods
   */
  async search(
    query: string,
    options: UnifiedSearchOptions = {}
  ): Promise<UnifiedSearchResult[]> {
    const {
      searchType = 'hybrid',
      limit = 20,
      threshold = 0.1,
      includeContent = true,
      userId,
      documentIds,
      isDeleted = false,
      abortSignal
    } = options

    // Check if operation was cancelled
    if (abortSignal?.aborted) {
      return []
    }

    try {
      let results: UnifiedSearchResult[] = []

      switch (searchType) {
        case 'text':
          results = await this.textSearch(query, options)
          break
        case 'vector':
          results = await this.vectorSearch(query, options)
          break
        case 'rag':
          results = await this.ragSearch(query, options)
          break
        case 'hybrid':
        default:
          results = await this.hybridSearch(query, options)
          break
      }

      // Apply common filters
      if (userId) {
        results = results.filter(result => 
          result.metadata.documentId ? true : false // Only include results with documentId for now
        )
      }

      if (documentIds && documentIds.length > 0) {
        results = results.filter(result => 
          result.metadata.documentId && documentIds.includes(result.metadata.documentId)
        )
      }

      // Sort by score/similarity and limit results
      results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      return results.slice(0, limit)

    } catch (error) {
      console.error('Unified search error:', error)
      return []
    }
  }

  /**
   * Text-based search using database queries
   */
  private async textSearch(
    query: string,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    const { userId, limit = 20, searchFields = ['title', 'plainText'] } = options

    if (!userId) {
      return []
    }

    try {
      // Search documents
      const documents = await prisma.document.findMany({
        where: {
          userId,
          isDeleted: false,
          OR: searchFields.map(field => ({
            [field]: {
              contains: query,
              mode: 'insensitive' as const
            }
          }))
        },
        select: {
          id: true,
          title: true,
          plainText: true,
          wordCount: true,
          isStarred: true,
          updatedAt: true
        },
        take: limit,
        orderBy: { updatedAt: 'desc' }
      })

      return documents.map(doc => ({
        id: doc.id,
        type: 'document' as const,
        title: doc.title,
        content: doc.plainText || '',
        preview: doc.plainText ? doc.plainText.substring(0, 150) + '...' : 'No content yet...',
        metadata: {
          documentId: doc.id,
          wordCount: doc.wordCount,
          isStarred: doc.isStarred,
          updatedAt: doc.updatedAt,
          source: 'text' as const
        }
      }))

    } catch (error) {
      console.error('Text search error:', error)
      return []
    }
  }

  /**
   * Vector-based search using embeddings
   */
  private async vectorSearch(
    query: string,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    const { userId, limit = 20, threshold = 0.1 } = options

    if (!userId) {
      return []
    }

    try {
      const vectorOptions: VectorSearchOptionsType = {
        limit,
        threshold,
        includeContent: true,
        useHybridSearch: options.useHybridSearch,
        useQueryExpansion: options.useQueryExpansion,
        useQueryRewriting: options.useQueryRewriting,
        searchStrategy: options.searchStrategy,
        abortSignal: options.abortSignal
      }

      const results = await vectorSearch(query, userId, vectorOptions)

      return results.map(result => ({
        id: `${result.documentId}-${result.chunkIndex}`,
        type: 'chunk' as const,
        title: result.documentTitle,
        content: result.content,
        preview: result.content.substring(0, 150) + '...',
        similarity: result.similarity,
        score: result.score,
        metadata: {
          documentId: result.documentId,
          chunkIndex: result.chunkIndex,
          updatedAt: new Date(), // Would need to get actual date from chunk
          source: 'vector' as const
        }
      }))

    } catch (error) {
      console.error('Vector search error:', error)
      return []
    }
  }

  /**
   * RAG-based search using the RAG adapter
   */
  private async ragSearch(
    query: string,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    const { projectId, topK = 20 } = options

    if (!projectId) {
      return []
    }

    try {
      const chunks = await ragAdapter.search(query, {
        topK,
        projectId
      })

      return chunks.map(chunk => ({
        id: chunk.id,
        type: 'chunk' as const,
        title: chunk.docId,
        content: chunk.text,
        preview: chunk.text.substring(0, 150) + '...',
        similarity: chunk.score,
        metadata: {
          documentId: chunk.docId,
          chunkIndex: 0, // Would need to extract from chunk.id
          updatedAt: chunk.updatedAt,
          source: 'rag' as const
        }
      }))

    } catch (error) {
      console.error('RAG search error:', error)
      return []
    }
  }

  /**
   * Hybrid search combining multiple methods
   */
  private async hybridSearch(
    query: string,
    options: UnifiedSearchOptions
  ): Promise<UnifiedSearchResult[]> {
    const { userId, projectId, limit = 20 } = options

    try {
      // Run searches in parallel
      const [textResults, vectorResults, ragResults] = await Promise.allSettled([
        userId ? this.textSearch(query, { ...options, limit: Math.ceil(limit * 0.3) }) : Promise.resolve([]),
        userId ? this.vectorSearch(query, { ...options, limit: Math.ceil(limit * 0.4) }) : Promise.resolve([]),
        projectId ? this.ragSearch(query, { ...options, limit: Math.ceil(limit * 0.3) }) : Promise.resolve([])
      ])

      // Combine results
      const allResults: UnifiedSearchResult[] = [
        ...(textResults.status === 'fulfilled' ? textResults.value : []),
        ...(vectorResults.status === 'fulfilled' ? vectorResults.value : []),
        ...(ragResults.status === 'fulfilled' ? ragResults.value : [])
      ]

      // Remove duplicates based on document ID
      const uniqueResults = new Map<string, UnifiedSearchResult>()
      
      for (const result of allResults) {
        const key = result.metadata.documentId || result.id
        if (!uniqueResults.has(key) || (result.similarity || 0) > (uniqueResults.get(key)?.similarity || 0)) {
          uniqueResults.set(key, result)
        }
      }

      return Array.from(uniqueResults.values())

    } catch (error) {
      console.error('Hybrid search error:', error)
      return []
    }
  }

  /**
   * Search documents only
   */
  async searchDocuments(
    query: string,
    userId: string,
    options: Omit<UnifiedSearchOptions, 'userId'> = {}
  ): Promise<UnifiedSearchResult[]> {
    return this.search(query, { ...options, userId, searchType: 'hybrid' })
  }

  /**
   * Search folders only
   */
  async searchFolders(
    query: string,
    userId: string,
    options: Omit<UnifiedSearchOptions, 'userId'> = {}
  ): Promise<UnifiedSearchResult[]> {
    // Implementation would go here for folder search
    return []
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(
    query: string,
    userId: string,
    limit: number = 5
  ): Promise<string[]> {
    try {
      // Simple implementation - could be enhanced with ML-based suggestions
      const results = await this.search(query, { userId, limit: 10 })
      
      return results
        .map(result => result.title)
        .filter((title, index, array) => array.indexOf(title) === index)
        .slice(0, limit)

    } catch (error) {
      console.error('Get suggestions error:', error)
      return []
    }
  }
}

// Export singleton instance
export const unifiedSearchService = UnifiedSearchService.getInstance()

// Export convenience functions
export async function unifiedSearch(
  query: string,
  options: UnifiedSearchOptions = {}
): Promise<UnifiedSearchResult[]> {
  return unifiedSearchService.search(query, options)
}

export async function searchDocuments(
  query: string,
  userId: string,
  options: Omit<UnifiedSearchOptions, 'userId'> = {}
): Promise<UnifiedSearchResult[]> {
  return unifiedSearchService.searchDocuments(query, userId, options)
}

export async function searchFolders(
  query: string,
  userId: string,
  options: Omit<UnifiedSearchOptions, 'userId'> = {}
): Promise<UnifiedSearchResult[]> {
  return unifiedSearchService.searchFolders(query, userId, options)
}
