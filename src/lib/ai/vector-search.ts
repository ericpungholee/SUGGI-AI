import { prisma } from '@/lib/prisma'
import { 
  createEmbedding, 
  findSimilarChunks, 
  DocumentChunk, 
  cosineSimilarity,
  expandQuery,
  rewriteQuery,
  hybridSearch,
  chunkTextAdaptive,
  compressContext,
  extractKeyInformation,
  adaptiveRetrieval,
  classifyQueryIntent
} from './embeddings'

export interface SearchResult {
  documentId: string
  documentTitle: string
  content: string
  similarity: number
  chunkIndex: number
  score?: number
  semanticScore?: number
  keywordScore?: number
}

export interface DocumentSearchOptions {
  limit?: number
  threshold?: number
  includeContent?: boolean
  useHybridSearch?: boolean
  useQueryExpansion?: boolean
  useQueryRewriting?: boolean
  searchStrategy?: 'semantic' | 'hybrid' | 'keyword' | 'adaptive'
  useAdaptiveRetrieval?: boolean
  abortSignal?: AbortSignal
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
      threshold = 0.1,
      includeContent = true,
      useHybridSearch = true,
      useQueryExpansion = true,
      useQueryRewriting = true,
      searchStrategy = 'hybrid',
      useAdaptiveRetrieval = true,
      abortSignal
    } = options

    // Check if operation was cancelled
    if (abortSignal?.aborted) {
      return []
    }

    console.log('Using advanced RAG search with strategy:', searchStrategy)
    
    // Use adaptive retrieval if enabled and strategy is adaptive
    if (useAdaptiveRetrieval && searchStrategy === 'adaptive') {
      return await adaptiveRetrieval(query, userId, options)
    }
    
    // Step 1: Query preprocessing
    let processedQuery = query
    let queryVariations: string[] = [query]
    
    try {
      if (useQueryRewriting) {
        // Check for cancellation before query rewriting
        if (abortSignal?.aborted) return []
        
        processedQuery = await rewriteQuery(query)
        console.log('Rewritten query:', processedQuery)
      }
    } catch (rewriteError) {
      if (abortSignal?.aborted) return []
      console.warn('Query rewriting failed, using original query:', rewriteError)
      processedQuery = query
    }
    
    try {
      if (useQueryExpansion) {
        // Check for cancellation before query expansion
        if (abortSignal?.aborted) return []
        
        queryVariations = await expandQuery(processedQuery)
        console.log('Query variations:', queryVariations)
      }
    } catch (expansionError) {
      if (abortSignal?.aborted) return []
      console.warn('Query expansion failed, using single query:', expansionError)
      queryVariations = [processedQuery]
    }

    // Step 2: Generate embeddings for all query variations
    let queryEmbeddings: any[] = []
    let primaryQueryEmbedding: number[] = []
    
    try {
      // Check for cancellation before embedding generation
      if (abortSignal?.aborted) return []
      
      queryEmbeddings = await Promise.all(
        queryVariations.map(q => createEmbedding(q))
      )
      primaryQueryEmbedding = queryEmbeddings[0].embedding
    } catch (embeddingError) {
      if (abortSignal?.aborted) return []
      console.error('Error generating embeddings:', embeddingError)
      throw new Error(`Failed to generate embeddings: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`)
    }

    // Step 3: Get document chunks
    console.log('Searching for chunks with userId:', userId)
    let chunks: any[] = []
    let documentChunks: DocumentChunk[] = []
    
    try {
      chunks = await prisma.documentChunk.findMany({
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

      if (chunks.length === 0) {
        console.log('No document chunks found for user')
        return []
      }

      // Convert to DocumentChunk format and handle dimension mismatches
      documentChunks = chunks
        .filter(chunk => chunk.embedding && Array.isArray(chunk.embedding))
        .map(chunk => {
          const embedding = chunk.embedding as number[]
          
          // Handle dimension mismatch between old (1536) and new (3072) embeddings
          if (embedding.length === 1536) {
            console.warn(`Chunk ${chunk.id} has old embedding dimension (1536). Consider re-vectorizing.`)
            // Skip chunks with old dimensions to avoid poor search results
            return null
          }
          
          return {
            id: chunk.id,
            documentId: chunk.documentId,
            content: chunk.content,
            embedding: embedding,
            chunkIndex: chunk.chunkIndex
          }
        })
        .filter(chunk => chunk !== null) as DocumentChunk[]

      if (documentChunks.length === 0) {
        console.log('No chunks with valid embeddings found')
        return []
      }
    } catch (dbError) {
      console.error('Error fetching document chunks:', dbError)
      throw new Error(`Failed to fetch document chunks: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
    }

    // Step 4: Perform search based on strategy
    let similarChunks: DocumentChunk[] = []
    
    try {
      if (searchStrategy === 'hybrid' && useHybridSearch) {
        // Use hybrid search combining semantic and keyword matching
        similarChunks = hybridSearch(
          processedQuery,
          primaryQueryEmbedding,
          documentChunks,
          limit * 2, // Get more results for re-ranking
          0.7, // semantic weight
          0.3  // keyword weight
        )
      } else if (searchStrategy === 'semantic') {
        // Use pure semantic search
        similarChunks = findSimilarChunks(
          primaryQueryEmbedding,
          documentChunks,
          limit * 2,
          threshold
        )
      } else {
        // Fallback to basic similarity
        const similarities = documentChunks.map(chunk => ({
          chunk,
          similarity: cosineSimilarity(primaryQueryEmbedding, chunk.embedding)
        }))

        similarChunks = similarities
          .filter(item => item.similarity >= threshold)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit * 2)
          .map(item => item.chunk)
      }
    } catch (searchError) {
      console.error('Error in search operation:', searchError)
      throw new Error(`Failed to perform search: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`)
    }

    // Step 5: Re-rank results using multiple query variations
    if (queryVariations.length > 1) {
      try {
        const rerankedChunks = await rerankWithMultipleQueries(
          similarChunks,
          queryVariations.slice(1), // Skip primary query
          limit
        )
        similarChunks = rerankedChunks
      } catch (rerankError) {
        console.warn('Re-ranking failed, using original results:', rerankError)
        // Continue with original results if re-ranking fails
      }
    }

    // Step 6: Advanced context selection and filtering
    let results: SearchResult[] = []
    
    try {
      // Convert to SearchResult format first
      const rawResults = similarChunks.map(chunk => {
        const similarity = cosineSimilarity(primaryQueryEmbedding, chunk.embedding)
        const dbChunk = chunks.find(c => c.id === chunk.id)
        
        if (!dbChunk) {
          console.warn(`Could not find database chunk for id: ${chunk.id}`)
          return {
            documentId: chunk.documentId,
            documentTitle: 'Unknown Document',
            content: includeContent ? chunk.content : '',
            similarity,
            chunkIndex: chunk.chunkIndex
          }
        }
        
        return {
          documentId: chunk.documentId,
          documentTitle: dbChunk.document.title,
          content: includeContent ? chunk.content : '',
          similarity,
          chunkIndex: chunk.chunkIndex
        }
      })

      // Apply advanced filtering and selection
      results = await selectBestContext(rawResults, query, limit)
    } catch (conversionError) {
      console.error('Error converting results:', conversionError)
      throw new Error(`Failed to convert search results: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`)
    }

    console.log(`Found ${results.length} similar documents with advanced RAG`)
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
 * Advanced re-ranking with multiple scoring factors
 */
async function rerankWithMultipleQueries(
  chunks: DocumentChunk[],
  queryVariations: string[],
  limit: number
): Promise<DocumentChunk[]> {
  try {
    // Generate embeddings for query variations
    const variationEmbeddings = await Promise.all(
      queryVariations.map(q => createEmbedding(q))
    )

    // Score each chunk against all query variations with multiple factors
    const scoredChunks = chunks.map(chunk => {
      let totalScore = 0
      let maxScore = 0
      let minScore = 1
      let scoreVariance = 0

      // Calculate scores for each query variation
      const scores = variationEmbeddings.map(embedding => 
        cosineSimilarity(embedding.embedding, chunk.embedding)
      )

      // Calculate statistics
      totalScore = scores.reduce((sum, score) => sum + score, 0)
      maxScore = Math.max(...scores)
      minScore = Math.min(...scores)
      const avgScore = totalScore / scores.length

      // Calculate variance (consistency across queries)
      scoreVariance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length

      // Multi-factor scoring:
      // 1. Max score (best match) - 40%
      // 2. Average score (overall relevance) - 30%
      // 3. Consistency (low variance) - 20%
      // 4. Content length bonus (longer chunks often more informative) - 10%
      const lengthBonus = Math.min(chunk.content.length / 1000, 0.1) // Cap at 0.1
      const consistencyBonus = Math.max(0, 0.1 - scoreVariance) // Reward consistency
      
      const combinedScore = 
        maxScore * 0.4 + 
        avgScore * 0.3 + 
        consistencyBonus * 0.2 + 
        lengthBonus * 0.1

      return {
        chunk,
        maxScore,
        avgScore,
        consistencyBonus,
        lengthBonus,
        combinedScore
      }
    })

    // Sort by combined score and return top results
    return scoredChunks
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit)
      .map(item => item.chunk)
  } catch (error) {
    console.error('Error re-ranking chunks:', error)
    return chunks.slice(0, limit) // Fallback to original order
  }
}

/**
 * Advanced context selection for better accuracy
 */
async function selectBestContext(
  results: SearchResult[],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    if (results.length === 0) return []

    // 1. Remove duplicates and very similar content
    const uniqueResults = removeDuplicateContent(results)
    
    // 2. Apply content quality scoring
    const qualityScored = uniqueResults.map(result => ({
      ...result,
      qualityScore: calculateContentQuality(result, query)
    }))

    // 3. Apply diversity scoring (prefer different documents)
    const diversityScored = applyDiversityScoring(qualityScored)

    // 4. Sort by combined score (similarity + quality + diversity)
    const finalResults = diversityScored
      .sort((a, b) => {
        const scoreA = a.similarity * 0.5 + a.qualityScore * 0.3 + (a.diversityScore || 0) * 0.2
        const scoreB = b.similarity * 0.5 + b.qualityScore * 0.3 + (b.diversityScore || 0) * 0.2
        return scoreB - scoreA
      })
      .slice(0, limit)

    return finalResults
  } catch (error) {
    console.error('Error in context selection:', error)
    return results.slice(0, limit) // Fallback to original results
  }
}

/**
 * Remove duplicate or very similar content
 */
function removeDuplicateContent(results: SearchResult[]): SearchResult[] {
  const unique: SearchResult[] = []
  const seen = new Set<string>()

  for (const result of results) {
    // Create a simple hash of the content for deduplication
    const contentHash = result.content.toLowerCase().replace(/\s+/g, ' ').trim()
    const hash = `${result.documentId}-${contentHash.substring(0, 100)}`
    
    if (!seen.has(hash)) {
      seen.add(hash)
      unique.push(result)
    }
  }

  return unique
}

/**
 * Calculate content quality score based on query relevance
 */
function calculateContentQuality(result: SearchResult, query: string): number {
  const content = result.content.toLowerCase()
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
  
  // 1. Keyword density score
  const keywordMatches = queryTerms.filter(term => content.includes(term)).length
  const keywordScore = queryTerms.length > 0 ? keywordMatches / queryTerms.length : 0
  
  // 2. Content length score (prefer substantial content)
  const lengthScore = Math.min(1, result.content.length / 500) // Normalize to 0-1
  
  // 3. Specificity score (prefer content with specific details)
  const hasNumbers = /\d+/.test(result.content)
  const hasSpecificTerms = /(?:specifically|particularly|exactly|precisely|detailed)/i.test(result.content)
  const specificityScore = (hasNumbers ? 0.3 : 0) + (hasSpecificTerms ? 0.2 : 0)
  
  // 4. Structure score (prefer well-structured content)
  const hasStructure = /(?:first|second|third|finally|in conclusion|however|therefore)/i.test(result.content)
  const structureScore = hasStructure ? 0.2 : 0
  
  return keywordScore * 0.4 + lengthScore * 0.3 + specificityScore * 0.2 + structureScore * 0.1
}

/**
 * Apply diversity scoring to prefer different documents
 */
function applyDiversityScoring(results: SearchResult[]): (SearchResult & { diversityScore: number })[] {
  const documentCounts = new Map<string, number>()
  
  return results.map(result => {
    const currentCount = documentCounts.get(result.documentId) || 0
    documentCounts.set(result.documentId, currentCount + 1)
    
    // Penalize results from documents we've already seen
    const diversityScore = Math.max(0, 1 - currentCount * 0.3)
    
    return {
      ...result,
      diversityScore
    }
  })
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
      limit: limit * 2, // Get more results for better context
      threshold: 0.15, // Slightly higher threshold for better quality
      includeContent: true,
      useHybridSearch: true,
      useQueryExpansion: true,
      useQueryRewriting: true,
      searchStrategy: 'adaptive', // Use adaptive retrieval for better context
      useAdaptiveRetrieval: true
    })

    // Filter by specific document if provided
    const relevantResults = documentId 
      ? searchResults.filter(result => result.documentId === documentId)
      : searchResults

    if (relevantResults.length === 0) {
      return ''
    }

    // Take top results and format context with better structure
    const topResults = relevantResults.slice(0, limit)
    
    // Group results by document for better organization
    const groupedResults = topResults.reduce((acc, result) => {
      if (!acc[result.documentId]) {
        acc[result.documentId] = {
          title: result.documentTitle,
          chunks: []
        }
      }
      acc[result.documentId].chunks.push(result)
      return acc
    }, {} as Record<string, { title: string; chunks: SearchResult[] }>)

    // Format context with document grouping
    let context = Object.entries(groupedResults)
      .map(([docId, docData]) => {
        const chunks = docData.chunks
          .sort((a, b) => a.chunkIndex - b.chunkIndex) // Sort by chunk order
          .map((result, index) => {
            const content = result.content.length > 300 
              ? result.content.substring(0, 300) + '...'
              : result.content
            
            return `  ${index + 1}. ${content}`
          })
          .join('\n\n')

        return `**${docData.title}**\n${chunks}`
      })
      .join('\n\n---\n\n')

    // Compress context if it's too long
    if (context.length > 4000) { // Rough token limit
      try {
        context = await compressContext(context, 2000)
      } catch (error) {
        console.error('Error compressing context:', error)
        // Fallback to truncation
        context = context.substring(0, 4000) + '...'
      }
    }

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

    // Process document content into chunks using adaptive chunking
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
