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
      threshold = 0.1, // Lowered for better recall while maintaining quality
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

    // Using advanced RAG search with strategy
    
    // Use adaptive retrieval if enabled and strategy is adaptive
    // But prevent infinite recursion by disabling adaptive retrieval in the call
    if (useAdaptiveRetrieval && searchStrategy === 'adaptive') {
      const adaptiveOptions = { ...options, useAdaptiveRetrieval: false }
      return await adaptiveRetrieval(query, userId, adaptiveOptions)
    }
    
    // Step 1: Query preprocessing (skip for simple queries)
    let processedQuery = query
    let queryVariations: string[] = [query]
    
    // Skip query rewriting and expansion for simple follow-up queries
    const isSimpleQuery = query.length < 30 || 
      query.toLowerCase().includes('tell me more') ||
      query.toLowerCase().includes('what about') ||
      query.toLowerCase().includes('more info')
    
    if (!isSimpleQuery) {
      try {
        if (useQueryRewriting) {
          // Check for cancellation before query rewriting
          if (abortSignal?.aborted) return []
          
          processedQuery = await rewriteQuery(query)
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
        }
      } catch (expansionError) {
        if (abortSignal?.aborted) return []
        console.warn('Query expansion failed, using single query:', expansionError)
        queryVariations = [processedQuery]
      }
    }

    // Check for cancellation before vector search
    if (abortSignal?.aborted) {
      return []
    }

    // Step 2: Use Pinecone for vector search with fallback
    let vectorResults: any[] = []
    
    try {
      const { vectorDB } = await import('./vector-db')
      vectorResults = await vectorDB.searchDocuments(processedQuery, userId, {
        topK: limit * 3, // Get more results for better re-ranking
        threshold: Math.max(threshold, 0.1), // Lowered threshold for better recall
        includeMetadata: true,
        searchStrategy: searchStrategy === 'hybrid' ? 'semantic' : (searchStrategy === 'adaptive' ? 'semantic' : searchStrategy),
        useHybridSearch: useHybridSearch
      })

      if (vectorResults.length === 0) {
        return []
      }
    } catch (pineconeError) {
      console.error('Pinecone search failed, falling back to PostgreSQL search:', {
        error: pineconeError instanceof Error ? pineconeError.message : 'Unknown error',
        query: processedQuery.substring(0, 100),
        userId
      })
      
      // Check for cancellation before fallback search
      if (abortSignal?.aborted) {
        return []
      }
      
      try {
        // Fallback to PostgreSQL search if Pinecone fails
        const documents = await prisma.document.findMany({
          where: {
            userId,
            isDeleted: false,
            isVectorized: true
          },
          select: {
            id: true,
            title: true,
            plainText: true,
            content: true
          }
        })

        if (documents.length === 0) {
          return []
        }

        // Simple keyword-based fallback search
        const queryTerms = processedQuery.toLowerCase().split(/\s+/).filter(term => term.length > 2)
        const fallbackResults = documents
          .filter(doc => {
            const content = (doc.plainText || JSON.stringify(doc.content)).toLowerCase()
            return queryTerms.some(term => content.includes(term))
          })
          .slice(0, limit)
          .map(doc => ({
            id: doc.id,
            score: 0.5, // Default score for fallback
            content: doc.plainText || JSON.stringify(doc.content),
            metadata: {
              documentId: doc.id,
              documentTitle: doc.title,
              userId: userId,
              chunkIndex: 0,
              createdAt: new Date().toISOString()
            }
          }))

        vectorResults = fallbackResults
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError)
        // Return empty results if both Pinecone and fallback fail
        return []
      }
    }

    // Step 3: Get document content from database for the results
    const documentIds = vectorResults.map(result => result.metadata.documentId)
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        userId,
        isDeleted: false
      },
      select: {
        id: true,
        title: true,
        plainText: true,
        content: true
      }
    })

    // Step 4: Combine vector results with database content
    const results: SearchResult[] = vectorResults.map(result => {
      const dbDocument = documents.find(d => d.id === result.metadata.documentId)
      
      if (!dbDocument) {
        console.warn(`Could not find database document for id: ${result.metadata.documentId}`)
        return {
          documentId: result.metadata.documentId,
          documentTitle: result.metadata.documentTitle,
          content: includeContent ? result.content : '',
          similarity: result.score,
          chunkIndex: 0 // Single document = chunk 0
        }
      }
      
      // Use the content from the database document (full content)
      const content = includeContent ? (dbDocument.plainText || JSON.stringify(dbDocument.content)) : ''
      
      return {
        documentId: result.metadata.documentId,
        documentTitle: dbDocument.title,
        content: content,
        similarity: result.score,
        chunkIndex: 0 // Single document = chunk 0
      }
    })

    // Step 5: Apply advanced filtering and selection
    const filteredResults = await selectBestContext(results, query, limit)
    return filteredResults
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
    if (results.length === 0) {
      return []
    }

    // Fast path for small result sets
    if (results.length <= limit * 2) {
      const uniqueResults = removeDuplicateContent(results)
      return uniqueResults.slice(0, limit)
    }

    // 1. Remove duplicates and very similar content (fast)
    const uniqueResults = removeDuplicateContent(results)
    
    // 2. Pre-filter by similarity threshold (fast) - lowered threshold
    const highSimilarityResults = uniqueResults.filter(r => r.similarity >= 0.15)
    if (highSimilarityResults.length >= limit) {
      return highSimilarityResults
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
    }

    // 3. Apply fast quality scoring (no AI calls)
    const qualityScored = uniqueResults.map(result => ({
      ...result,
      qualityScore: calculateFastQualityScore(result, query)
    }))

    // 4. Apply diversity scoring (fast)
    const diversityScored = applyDiversityScoring(qualityScored)

    // 5. Sort by fast combined score (no AI calls)
    const finalResults = diversityScored
      .sort((a, b) => {
        const scoreA = calculateFastScore(a, query)
        const scoreB = calculateFastScore(b, query)
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
 * Calculate enhanced content quality score based on query relevance
 */
function calculateEnhancedContentQuality(result: SearchResult, query: string): number {
  const content = result.content.toLowerCase()
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
  
  // 1. Enhanced keyword density score with phrase matching
  const keywordMatches = queryTerms.filter(term => content.includes(term)).length
  const keywordScore = queryTerms.length > 0 ? keywordMatches / queryTerms.length : 0
  
  // 2. Exact phrase matching bonus
  const phraseScore = content.includes(query.toLowerCase()) ? 0.3 : 0
  
  // 3. Content length score (prefer substantial but not too long content)
  const optimalLength = 300
  const lengthScore = Math.min(1, 1 - Math.abs(result.content.length - optimalLength) / optimalLength)
  
  // 4. Enhanced specificity score
  const hasNumbers = /\d+/.test(result.content)
  const hasSpecificTerms = /(?:specifically|particularly|exactly|precisely|detailed|analysis|research|study|data|results)/i.test(result.content)
  const hasTechnicalTerms = /(?:algorithm|method|approach|technique|process|procedure)/i.test(result.content)
  const specificityScore = (hasNumbers ? 0.2 : 0) + (hasSpecificTerms ? 0.2 : 0) + (hasTechnicalTerms ? 0.1 : 0)
  
  // 5. Structure and coherence score
  const hasStructure = /(?:first|second|third|finally|in conclusion|however|therefore|moreover|furthermore)/i.test(result.content)
  const hasLists = /(?:^\s*[-*+]\s+|^\s*\d+\.\s+)/m.test(result.content)
  const structureScore = (hasStructure ? 0.15 : 0) + (hasLists ? 0.1 : 0)
  
  // 6. Query intent matching
  const isQuestion = query.includes('?')
  const hasAnswers = isQuestion && /(?:answer|solution|explanation|because|due to|as a result)/i.test(result.content)
  const intentScore = hasAnswers ? 0.2 : 0
  
  return keywordScore * 0.3 + phraseScore * 0.2 + lengthScore * 0.15 + specificityScore * 0.2 + structureScore * 0.1 + intentScore * 0.05
}

/**
 * Calculate semantic relevance using embedding similarity
 */
async function calculateSemanticRelevance(
  results: (SearchResult & { qualityScore: number })[],
  query: string
): Promise<(SearchResult & { qualityScore: number; semanticScore: number })[]> {
  try {
    const { createEmbedding } = await import('./embeddings')
    const queryEmbedding = await createEmbedding(query)
    
    return results.map(result => {
      // For single vector documents, we already have similarity from Pinecone
      // But we can enhance it with additional semantic analysis
      const baseSimilarity = result.similarity
      
      // Additional semantic scoring based on content analysis
      const content = result.content.toLowerCase()
      const queryTerms = query.toLowerCase().split(/\s+/)
      
      // Semantic word matching (not just exact matches)
      const semanticMatches = queryTerms.filter(term => {
        // Check for exact matches
        if (content.includes(term)) return true
        
        // Check for semantic variations
        const variations = getSemanticVariations(term)
        return variations.some(variation => content.includes(variation))
      }).length
      
      const semanticBonus = queryTerms.length > 0 ? semanticMatches / queryTerms.length : 0
      const enhancedSimilarity = Math.min(1, baseSimilarity + semanticBonus * 0.2)
      
      return {
        ...result,
        semanticScore: enhancedSimilarity
      }
    })
  } catch (error) {
    console.error('Error calculating semantic relevance:', error)
    return results.map(result => ({ ...result, semanticScore: result.similarity }))
  }
}

/**
 * Get semantic variations of a word for better matching
 */
function getSemanticVariations(word: string): string[] {
  const variations: string[] = []
  
  // Common word variations
  const commonVariations: Record<string, string[]> = {
    'analyze': ['analysis', 'analyzing', 'analytical'],
    'data': ['information', 'dataset', 'metrics'],
    'method': ['approach', 'technique', 'process'],
    'result': ['outcome', 'finding', 'conclusion'],
    'study': ['research', 'investigation', 'examination'],
    'test': ['testing', 'evaluation', 'assessment'],
    'model': ['algorithm', 'system', 'framework'],
    'performance': ['efficiency', 'effectiveness', 'accuracy'],
    'improve': ['enhance', 'optimize', 'better'],
    'problem': ['issue', 'challenge', 'difficulty']
  }
  
  const lowerWord = word.toLowerCase()
  if (commonVariations[lowerWord]) {
    variations.push(...commonVariations[lowerWord])
  }
  
  // Add plural/singular variations
  if (word.endsWith('s') && word.length > 3) {
    variations.push(word.slice(0, -1))
  } else if (!word.endsWith('s')) {
    variations.push(word + 's')
  }
  
  return variations
}

/**
 * Apply query-specific scoring based on query type
 */
function applyQuerySpecificScoring(
  results: (SearchResult & { qualityScore: number; semanticScore: number; diversityScore: number })[],
  query: string
): (SearchResult & { qualityScore: number; semanticScore: number; diversityScore: number; queryScore: number })[] {
  const isQuestion = query.includes('?')
  const isHowTo = /how\s+to/i.test(query)
  const isWhat = /what\s+is/i.test(query)
  const isWhy = /why/i.test(query)
  const isCompare = /compare|versus|vs|difference/i.test(query)
  
  return results.map(result => {
    let queryScore = 0
    
    if (isQuestion) {
      // Prefer content that directly answers questions
      const hasAnswers = /(?:answer|solution|explanation|because|due to|as a result|therefore)/i.test(result.content)
      queryScore += hasAnswers ? 0.3 : 0
    }
    
    if (isHowTo) {
      // Prefer step-by-step or procedural content
      const hasSteps = /(?:step|first|second|third|then|next|finally|procedure|process)/i.test(result.content)
      queryScore += hasSteps ? 0.3 : 0
    }
    
    if (isWhat) {
      // Prefer definitional or explanatory content
      const hasDefinitions = /(?:is|are|means|refers to|defined as|consists of)/i.test(result.content)
      queryScore += hasDefinitions ? 0.3 : 0
    }
    
    if (isWhy) {
      // Prefer content with reasoning or explanations
      const hasReasoning = /(?:because|due to|as a result|therefore|consequently|reason|explanation)/i.test(result.content)
      queryScore += hasReasoning ? 0.3 : 0
    }
    
    if (isCompare) {
      // Prefer content with comparisons or contrasts
      const hasComparison = /(?:versus|compared to|difference|similar|different|better|worse|advantage|disadvantage)/i.test(result.content)
      queryScore += hasComparison ? 0.3 : 0
    }
    
    return {
      ...result,
      queryScore
    }
  })
}

/**
 * Calculate fast quality score without AI calls
 */
function calculateFastQualityScore(result: SearchResult, query: string): number {
  const content = result.content.toLowerCase()
  const queryLower = query.toLowerCase()
  
  // Simple heuristics for quality
  let score = 0.5 // Base score
  
  // Length bonus (prefer substantial content)
  if (content.length > 200) score += 0.1
  if (content.length > 500) score += 0.1
  
  // Query term matches
  const queryTerms = queryLower.split(' ').filter(term => term.length > 2)
  const termMatches = queryTerms.filter(term => content.includes(term)).length
  score += (termMatches / queryTerms.length) * 0.3
  
  // Sentence structure bonus
  if (content.includes('.') && content.includes(' ')) score += 0.1
  
  return Math.min(1.0, Math.max(0.0, score))
}

/**
 * Calculate fast combined score without AI calls
 */
function calculateFastScore(
  result: SearchResult & { 
    qualityScore: number; 
    diversityScore: number; 
  },
  query: string
): number {
  // Simplified scoring focused on similarity + quality + diversity
  const weights = {
    similarity: 0.5,       // Primary: vector similarity
    quality: 0.3,          // Secondary: content quality
    diversity: 0.2         // Tertiary: diversity
  }
  
  return (
    result.similarity * weights.similarity +
    result.qualityScore * weights.quality +
    result.diversityScore * weights.diversity
  )
}

/**
 * Calculate final composite score for ranking
 */
function calculateFinalScore(
  result: SearchResult & { 
    qualityScore: number; 
    semanticScore: number; 
    diversityScore: number; 
    queryScore: number 
  },
  query: string
): number {
  // Weighted combination of all scores
  const weights = {
    similarity: 0.25,      // Original similarity from vector search
    quality: 0.25,         // Content quality score
    semantic: 0.20,        // Enhanced semantic relevance
    diversity: 0.15,       // Diversity across documents
    query: 0.15           // Query-specific relevance
  }
  
  return (
    result.similarity * weights.similarity +
    result.qualityScore * weights.quality +
    result.semanticScore * weights.semantic +
    result.diversityScore * weights.diversity +
    result.queryScore * weights.query
  )
}

/**
 * Apply diversity scoring to prefer different documents
 */
function applyDiversityScoring(results: (SearchResult & { qualityScore: number })[]): (SearchResult & { qualityScore: number; diversityScore: number })[] {
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
  documentIds?: string | string[],
  limit: number = 5
): Promise<string> {
  try {
    // Normalize documentIds to array
    const docIds = Array.isArray(documentIds) ? documentIds : documentIds ? [documentIds] : []
    
    // If specific documents are requested, get their content directly first
    if (docIds.length > 0) {
      try {
        const documents = await prisma.document.findMany({
          where: {
            id: { in: docIds },
            userId: userId,
            isDeleted: false
          },
          select: {
            id: true,
            title: true,
            content: true,
            plainText: true
          }
        })

        if (documents.length > 0) {
          // For single document, return full content
          if (documents.length === 1) {
            const document = documents[0]
            const content = document.plainText || extractTextFromContent(document.content)
            
            if (content && content.trim().length > 0) {
              // For summarization requests, return the full document content
              if (query.toLowerCase().includes('summar') || query.toLowerCase().includes('summary') || query.toLowerCase().includes('about')) {
                return `Document: "${document.title}"\n\nContent:\n${content}`
              }
              
              // For other queries, use the full content as context
              return `Document: "${document.title}"\n\nContent:\n${content}`
            }
          } else {
            // For multiple documents, combine their content
            const combinedContent = documents
              .map(doc => {
                const content = doc.plainText || extractTextFromContent(doc.content)
                return content && content.trim().length > 0 ? `**${doc.title}**\n\n${content}` : null
              })
              .filter(Boolean)
              .join('\n\n---\n\n')
            
            if (combinedContent) {
              return `Query: "${query}"\n\nRelevant Context (use document TITLES when citing sources):\n\n${combinedContent}`
            }
          }
        }
      } catch (error) {
        console.warn('Failed to get document content directly:', error)
        // Fall back to vector search
      }
    }

    const searchResults = await searchSimilarDocuments(query, userId, {
      limit: limit * 4, // Get more results for better context selection
      threshold: 0.15, // Lowered threshold to ensure we get some results
      includeContent: true,
      useHybridSearch: true,
      useQueryExpansion: true,
      useQueryRewriting: true,
      searchStrategy: 'adaptive', // Use adaptive retrieval for better context
      useAdaptiveRetrieval: true
    })

    // Filter by specific documents if provided
    const relevantResults = docIds.length > 0
      ? searchResults.filter(result => docIds.includes(result.documentId))
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

    // Format context with document grouping and similarity scores
    let context = Object.entries(groupedResults)
      .map(([docId, docData]) => {
        const chunks = docData.chunks
          .sort((a, b) => a.chunkIndex - b.chunkIndex) // Sort by chunk order
          .map((result, index) => {
            // Don't truncate content - let the full content through
            const content = result.content
            
            const similarity = (result.similarity * 100).toFixed(1)
            return `  ${index + 1}. [Similarity: ${similarity}%] ${content}`
          })
          .join('\n\n')

        return `**${docData.title}**\n${chunks}`
      })
      .join('\n\n---\n\n')

    // Add query context at the top
    context = `Query: "${query}"\n\nRelevant Context (use document TITLES when citing sources):\n\n${context}`

    // Compress context if it's too long
    if (context.length > 12000) { // Increased token limit for better context
      try {
        context = await compressContext(context, 8000)
      } catch (error) {
        console.error('Error compressing context:', error)
        // Fallback to truncation
        context = context.substring(0, 12000) + '...'
      }
    }
    return context
  } catch (error) {
    console.error('Error getting document context:', {
      query,
      userId,
      documentIds,
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

    if (!content || content.trim().length === 0) {
      return
    }

    // Generate single embedding for the entire document
    const { createEmbedding } = await import('./embeddings')
    const embeddingResult = await createEmbedding(content)

    // Store single vector in Pinecone
    const { vectorDB } = await import('./vector-db')
    const vectorDocument = {
      id: documentId, // Use document ID as the vector ID
      content: content,
      metadata: {
        documentId: documentId,
        documentTitle: document.title,
        userId: userId,
        chunkIndex: 0, // Single document = chunk 0
        createdAt: new Date().toISOString(),
        content: content,
        contentType: 'text',
        documentType: 'document',
        wordCount: content.split(/\s+/).length
      }
    }

    await vectorDB.upsertDocuments([vectorDocument])

    // Update document as vectorized with the embedding
    await prisma.document.update({
      where: { id: documentId },
      data: {
        isVectorized: true,
        embedding: embeddingResult.embedding, // Store the single document embedding
        wordCount: content.split(/\s+/).length
      }
    })

    // Clean up any existing chunks (we're using single vector now)
    await prisma.documentChunk.deleteMany({
      where: { documentId }
    })

    // Document vectorized successfully
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

// Import centralized utility
// Utility function for content extraction
function extractTextFromContent(content: any): string {
  if (typeof content === 'string') {
    return content
  }
  
  if (typeof content === 'object' && content !== null) {
    if (content.type === 'doc' && Array.isArray(content.content)) {
      return content.content
        .map((item: any) => {
          if (item.type === 'paragraph' && Array.isArray(item.content)) {
            return item.content
              .map((p: any) => p.text || '')
              .join('')
          }
          return item.text || ''
        })
        .join('\n')
    }
    
    // Fallback: try to extract text from any text properties
    if (content.text) {
      return content.text
    }
    
    // Last resort: stringify the object
    return JSON.stringify(content)
  }
  
  return ''
}
