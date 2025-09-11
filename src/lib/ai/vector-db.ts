import { Pinecone } from '@pinecone-database/pinecone'

export interface VectorDocument {
  id: string
  content: string
  metadata: {
    documentId: string
    documentTitle: string
    userId: string
    chunkIndex: number
    createdAt: string
    contentType?: string
    documentType?: string
    tags?: string[]
    importance?: number
  }
}

export interface VectorSearchResult {
  id: string
  score: number
  content: string
  metadata: {
    documentId: string
    documentTitle: string
    userId: string
    chunkIndex: number
    createdAt: string
  }
}

export interface VectorSearchOptions {
  topK?: number
  filter?: Record<string, any>
  includeMetadata?: boolean
  searchStrategy?: 'semantic' | 'hybrid' | 'keyword'
  useHybridSearch?: boolean
  threshold?: number
}

class VectorDatabase {
  private pinecone: Pinecone | null = null
  private index: any = null
  private isInitialized = false
  private currentIndexName: string | null = null

  async initialize() {
    const expectedIndexName = process.env.PINECONE_INDEX_NAME || 'ssugi-docs'
    if (this.isInitialized && this.currentIndexName === expectedIndexName) return

    try {
      const apiKey = process.env.PINECONE_API_KEY
      const indexName = process.env.PINECONE_INDEX_NAME || 'ssugi-docs'

      console.log('Initializing Pinecone with API key:', apiKey ? 'Present' : 'Missing')
      console.log('Index name:', indexName)

      if (!apiKey) {
        throw new Error('PINECONE_API_KEY environment variable is required')
      }

      this.pinecone = new Pinecone({
        apiKey
      })

      // Get or create index
      const indexList = await this.pinecone.listIndexes()
      console.log('Available indexes:', indexList.indexes?.map(idx => idx.name))
      
      const existingIndex = indexList.indexes?.find(idx => idx.name === indexName)

      if (!existingIndex) {
        console.log(`Creating Pinecone index: ${indexName}`)
        await this.pinecone.createIndex({
          name: indexName,
          dimension: 1536, // OpenAI text-embedding-ada-002 dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        })
        console.log(`Pinecone index ${indexName} created, waiting for it to be ready...`)
        
        // Wait for index to be ready
        await this.waitForIndexReady(indexName)
      } else {
        console.log(`Using existing Pinecone index: ${indexName}`)
      }

      this.index = this.pinecone.index(indexName)
      this.isInitialized = true
      this.currentIndexName = indexName

      console.log(`Pinecone initialized with index: ${indexName}`)
    } catch (error) {
      console.error('Failed to initialize Pinecone:', error)
      throw new Error('Vector database initialization failed')
    }
  }

  private async waitForIndexReady(indexName: string, maxWaitTime = 300000) {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const indexDescription = await this.pinecone!.describeIndex(indexName)
        if (indexDescription.status?.ready) {
          console.log(`Index ${indexName} is ready`)
          return
        }
        console.log(`Waiting for index ${indexName} to be ready...`)
        await new Promise(resolve => setTimeout(resolve, 5000))
      } catch (error) {
        console.log(`Waiting for index ${indexName}...`)
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
    
    throw new Error(`Index ${indexName} did not become ready within ${maxWaitTime}ms`)
  }

  async upsertDocuments(documents: VectorDocument[]) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      console.log(`Upserting ${documents.length} documents to vector database`)
      
      // Generate embeddings for all documents
      const { createEmbeddings } = await import('./embeddings')
      const embeddings = await createEmbeddings(documents.map(doc => doc.content))

      // Validate embeddings
      const expectedDimension = 1536 // Updated for text-embedding-ada-002
      for (let i = 0; i < embeddings.length; i++) {
        const embedding = embeddings[i].embedding
        if (!Array.isArray(embedding)) {
          throw new Error(`Embedding ${i} is not an array`)
        }
        if (embedding.length !== expectedDimension) {
          throw new Error(`Embedding ${i} has invalid length: ${embedding.length}, expected: ${expectedDimension}`)
        }
        // Check for NaN or invalid values
        if (embedding.some(val => typeof val !== 'number' || isNaN(val))) {
          throw new Error(`Embedding ${i} contains invalid values`)
        }
      }

      const records = documents.map((doc, index) => ({
        id: doc.id,
        values: embeddings[index].embedding,
        metadata: doc.metadata
      }))

      console.log(`Records prepared for upsert:`, records.length)
      console.log(`First record embedding length:`, records[0]?.values?.length)

      await this.index.upsert(records)
      console.log(`Successfully upserted ${documents.length} documents to vector database`)
    } catch (error) {
      console.error('Error upserting documents to vector database:', error)
      throw new Error(`Failed to upsert documents to vector database: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async searchDocuments(
    query: string,
    userId: string,
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize()
      }

      // Check if index is available
      if (!this.index) {
        throw new Error('Vector database index is not initialized')
      }

      // Check if Pinecone is available
      if (!this.pinecone) {
        throw new Error('Pinecone client is not initialized')
      }
    } catch (initError) {
      console.error('Failed to initialize vector database:', initError)
      throw new Error(`Vector database initialization failed: ${initError instanceof Error ? initError.message : 'Unknown error'}`)
    }

    try {
      const { 
        topK = 10, 
        filter = {}, 
        includeMetadata = true,
        searchStrategy = 'semantic',
        useHybridSearch = false,
        threshold = 0.1
      } = options

      // Search with user filter - with integrated models, we just pass the query text
      const searchFilter = {
        userId: { $eq: userId },
        ...filter
      }

      // Generate embedding for query manually
      const { createEmbedding } = await import('./embeddings')
      const queryEmbedding = await createEmbedding(query)

      // Validate query embedding
      const expectedDimension = 1536 // Updated for text-embedding-ada-002
      if (!Array.isArray(queryEmbedding.embedding)) {
        throw new Error('Query embedding is not an array')
      }
      if (queryEmbedding.embedding.length !== expectedDimension) {
        throw new Error(`Query embedding has invalid length: ${queryEmbedding.embedding.length}, expected: ${expectedDimension}`)
      }
      if (queryEmbedding.embedding.some(val => typeof val !== 'number' || isNaN(val))) {
        throw new Error('Query embedding contains invalid values')
      }

      console.log('Query embedding generated, length:', queryEmbedding.embedding.length)
      console.log('First few values:', queryEmbedding.embedding.slice(0, 5))

      // Use higher topK for hybrid search to allow for re-ranking
      const searchTopK = useHybridSearch ? topK * 2 : topK

      console.log('Executing Pinecone query with:', {
        vectorLength: queryEmbedding.embedding.length,
        topK: searchTopK,
        filter: searchFilter,
        includeMetadata
      })

      const searchResponse = await this.index.query({
        vector: queryEmbedding.embedding,
        topK: searchTopK,
        filter: searchFilter,
        includeMetadata
      })

      console.log('Pinecone query response:', {
        matchesCount: searchResponse.matches?.length || 0,
        hasMatches: !!searchResponse.matches
      })

      let results = searchResponse.matches?.map(match => ({
        id: match.id,
        score: match.score || 0,
        content: match.metadata?.content || '', // Get content from metadata
        metadata: match.metadata as any
      })) || []

      // Apply threshold filtering
      results = results.filter(result => result.score >= threshold)

      console.log(`Filtered results after threshold ${threshold}:`, results.length)

      // For hybrid search, implement keyword matching and re-ranking
      if (useHybridSearch && searchStrategy === 'hybrid') {
        results = await this.hybridSearchResults(query, results, topK)
      }

      return results.slice(0, topK)
    } catch (error) {
      console.error('Error searching vector database:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        query: query.substring(0, 100),
        userId,
        options,
        isInitialized: this.isInitialized,
        hasIndex: !!this.index,
        indexName: this.currentIndexName
      })
      
      // Check if it's a Pinecone-specific error
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('unauthorized')) {
          throw new Error('Pinecone authentication failed. Please check your API key.')
        } else if (error.message.includes('index') || error.message.includes('not found')) {
          throw new Error('Pinecone index not found. Please check your index configuration.')
        } else if (error.message.includes('dimension') || error.message.includes('vector')) {
          throw new Error('Vector dimension mismatch. Please check your embedding model.')
        }
      }
      
      throw new Error(`Failed to search vector database: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Enhanced hybrid search combining semantic and keyword matching
   */
  private async hybridSearchResults(
    query: string,
    semanticResults: VectorSearchResult[],
    limit: number
  ): Promise<VectorSearchResult[]> {
    try {
      const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
      
      // Enhanced scoring with multiple factors
      const scoredResults = semanticResults.map(result => {
        const content = (result.metadata?.content || '').toLowerCase()
        
        // 1. Basic keyword matching
        const keywordMatches = queryTerms.filter(term => content.includes(term)).length
        const keywordScore = queryTerms.length > 0 ? keywordMatches / queryTerms.length : 0
        
        // 2. Exact phrase matching bonus
        const phraseScore = content.includes(query.toLowerCase()) ? 0.3 : 0
        
        // 3. Proximity scoring (terms close together get higher score)
        let proximityScore = 0
        if (queryTerms.length > 1) {
          const termPositions = queryTerms.map(term => content.indexOf(term)).filter(pos => pos !== -1)
          if (termPositions.length > 1) {
            const avgDistance = termPositions.reduce((sum, pos, i) => 
              i > 0 ? sum + Math.abs(pos - termPositions[i-1]) : sum, 0) / (termPositions.length - 1)
            proximityScore = Math.max(0, 0.2 - (avgDistance / 200)) // Closer terms = higher score
          }
        }
        
        // 4. Content quality indicators
        const hasNumbers = /\d+/.test(result.metadata?.content || '')
        const hasSpecificTerms = /(?:specifically|particularly|exactly|precisely|detailed|analysis|research|study)/i.test(result.metadata?.content || '')
        const qualityScore = (hasNumbers ? 0.1 : 0) + (hasSpecificTerms ? 0.1 : 0)
        
        // 5. Query intent matching
        const isQuestion = query.includes('?')
        const hasAnswers = isQuestion && /(?:answer|solution|explanation|because|due to|as a result)/i.test(result.metadata?.content || '')
        const intentScore = hasAnswers ? 0.2 : 0
        
        // 6. Enhanced keyword score with all bonuses
        const enhancedKeywordScore = keywordScore + phraseScore + proximityScore + qualityScore + intentScore
        
        // 7. Combine semantic and enhanced keyword scores
        const combinedScore = (result.score * 0.6) + (enhancedKeywordScore * 0.4)
        
        return {
          ...result,
          score: Math.min(1, combinedScore), // Cap at 1.0
          semanticScore: result.score,
          keywordScore: enhancedKeywordScore
        }
      })

      // Sort by combined score and return top results
      return scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    } catch (error) {
      console.error('Error in hybrid search:', error)
      return semanticResults.slice(0, limit)
    }
  }

  async deleteDocuments(documentIds: string[]) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      await this.index.deleteMany(documentIds)
      console.log(`Deleted ${documentIds.length} documents from vector database`)
    } catch (error) {
      console.error('Error deleting documents from vector database:', error)
      throw new Error('Failed to delete documents from vector database')
    }
  }

  async deleteDocumentChunks(documentId: string) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      // Delete all chunks for a specific document
      await this.index.deleteMany({
        filter: {
          documentId: { $eq: documentId }
        }
      })
      console.log(`Deleted chunks for document ${documentId} from vector database`)
    } catch (error) {
      // Don't throw error for 404 - document chunks might not exist yet
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.log(`No chunks found for document ${documentId} in vector database (this is normal for new documents)`)
        return
      }
      console.error('Error deleting document chunks from vector database:', error)
      throw new Error('Failed to delete document chunks from vector database')
    }
  }

  async getDocumentStats(userId: string): Promise<{
    totalChunks: number
    totalDocuments: number
  }> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      // Get stats - if userId is empty, get all stats; otherwise filter by user
      const statsResponse = await this.index.describeIndexStats(
        userId && userId.trim() !== '' ? {
          filter: {
            userId: { $eq: userId }
          }
        } : {}
      )

      console.log('Pinecone stats response:', statsResponse)

      return {
        totalChunks: statsResponse.totalVectorCount || 0,
        totalDocuments: 0 // Would need separate query to count unique documents
      }
    } catch (error) {
      console.error('Error getting vector database stats:', error)
      return { totalChunks: 0, totalDocuments: 0 }
    }
  }
}

// Singleton instance
export const vectorDB = new VectorDatabase()

// Helper functions for RAG operations
export async function storeDocumentInVectorDB(
  documentId: string,
  documentTitle: string,
  content: string,
  userId: string
): Promise<void> {
  try {
    // Process content into chunks
    const { processDocumentContent } = await import('./embeddings')
    const chunks = await processDocumentContent(content, documentId)

    if (chunks.length === 0) {
      return
    }

    // Convert to vector documents
    const vectorDocuments: VectorDocument[] = chunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      metadata: {
        documentId: chunk.documentId,
        documentTitle,
        userId,
        chunkIndex: chunk.chunkIndex,
        createdAt: new Date().toISOString()
      }
    }))

    // Store in vector database
    await vectorDB.upsertDocuments(vectorDocuments)
  } catch (error) {
    console.error('Error storing document in vector DB:', error)
    throw new Error('Failed to store document in vector database')
  }
}

export async function searchDocumentsInVectorDB(
  query: string,
  userId: string,
  documentId?: string,
  limit: number = 5
): Promise<VectorSearchResult[]> {
  try {
    const filter: Record<string, any> = {}
    
    if (documentId) {
      filter.documentId = { $eq: documentId }
    }

    const results = await vectorDB.searchDocuments(query, userId, {
      topK: limit,
      filter,
      includeMetadata: true
    })

    // Fetch content for results (since we only store metadata in Pinecone)
    const { prisma } = await import('@/lib/prisma')
    const chunkIds = results.map(result => result.id)
    
    const chunks = await prisma.documentChunk.findMany({
      where: {
        id: { in: chunkIds }
      },
      select: {
        id: true,
        content: true
      }
    })

    // Map content to results
    return results.map(result => {
      const chunk = chunks.find(c => c.id === result.id)
      return {
        ...result,
        content: chunk?.content || ''
      }
    })
  } catch (error) {
    console.error('Error searching documents in vector DB:', error)
    throw new Error('Failed to search documents in vector database')
  }
}
