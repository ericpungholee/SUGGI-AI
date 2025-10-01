/**
 * Embedding Service with FAISS for ANN Search
 * Provides fast similarity search for learned routing
 */

import { OpenAI } from 'openai'
import { createHash } from 'crypto'

// Simple in-memory FAISS-like implementation
// In production, you'd use actual FAISS or similar
interface EmbeddingVector {
  id: string
  vector: number[]
  metadata: {
    query: string
    intent: string
    confidence: number
    timestamp: number
  }
}

interface SearchResult {
  id: string
  similarity: number
  metadata: EmbeddingVector['metadata']
}

export class EmbeddingService {
  private static instance: EmbeddingService
  private openai: OpenAI
  private vectors: EmbeddingVector[] = []
  private vectorCache: Map<string, number[]> = new Map()
  private readonly embeddingModel = 'text-embedding-3-small'
  private readonly dimension = 1536 // text-embedding-3-small dimension

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService()
    }
    return EmbeddingService.instance
  }

  /**
   * Generate embedding for text
   */
  async getEmbedding(text: string): Promise<number[]> {
    const cacheKey = this.getCacheKey(text)
    
    if (this.vectorCache.has(cacheKey)) {
      return this.vectorCache.get(cacheKey)!
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text.trim()
      })

      const embedding = response.data[0].embedding
      this.vectorCache.set(cacheKey, embedding)
      
      return embedding
    } catch (error) {
      console.error('Embedding generation failed:', error)
      // Return zero vector as fallback
      return new Array(this.dimension).fill(0)
    }
  }

  /**
   * Add labeled example to the vector store
   */
  async addExample(
    query: string, 
    intent: string, 
    confidence: number = 1.0
  ): Promise<string> {
    const embedding = await this.getEmbedding(query)
    const id = this.generateId(query, intent)
    
    const vector: EmbeddingVector = {
      id,
      vector: embedding,
      metadata: {
        query,
        intent,
        confidence,
        timestamp: Date.now()
      }
    }

    this.vectors.push(vector)
    return id
  }

  /**
   * Search for similar examples using cosine similarity
   */
  async searchSimilar(
    query: string, 
    topK: number = 5,
    intentFilter?: string
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.getEmbedding(query)
    
    const results = this.vectors
      .filter(v => !intentFilter || v.metadata.intent === intentFilter)
      .map(v => ({
        id: v.id,
        similarity: this.cosineSimilarity(queryEmbedding, v.vector),
        metadata: v.metadata
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)

    return results
  }

  /**
   * Get intent distribution from similar examples
   */
  async getIntentDistribution(
    query: string, 
    topK: number = 10
  ): Promise<Record<string, { count: number; avgConfidence: number; maxSimilarity: number }>> {
    const results = await this.searchSimilar(query, topK)
    
    const distribution: Record<string, { count: number; avgConfidence: number; maxSimilarity: number }> = {}
    
    results.forEach(result => {
      const intent = result.metadata.intent
      if (!distribution[intent]) {
        distribution[intent] = { count: 0, avgConfidence: 0, maxSimilarity: 0 }
      }
      
      distribution[intent].count++
      distribution[intent].avgConfidence += result.metadata.confidence
      distribution[intent].maxSimilarity = Math.max(distribution[intent].maxSimilarity, result.similarity)
    })

    // Calculate averages
    Object.values(distribution).forEach(stats => {
      stats.avgConfidence /= stats.count
    })

    return distribution
  }

  /**
   * Get examples for few-shot prompting
   */
  async getFewShotExamples(
    query: string,
    targetIntent: string,
    count: number = 3
  ): Promise<Array<{ query: string; intent: string; confidence: number }>> {
    const results = await this.searchSimilar(query, count * 2, targetIntent)
    
    return results
      .slice(0, count)
      .map(result => ({
        query: result.metadata.query,
        intent: result.metadata.intent,
        confidence: result.metadata.confidence
      }))
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    if (normA === 0 || normB === 0) return 0
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Generate cache key for text
   */
  private getCacheKey(text: string): string {
    return createHash('md5').update(text.toLowerCase().trim()).digest('hex')
  }

  /**
   * Generate unique ID for vector
   */
  private generateId(query: string, intent: string): string {
    const timestamp = Date.now()
    const hash = createHash('md5').update(`${query}-${intent}-${timestamp}`).digest('hex')
    return hash.substring(0, 16)
  }

  /**
   * Get vector store statistics
   */
  getStats(): { totalVectors: number; intentDistribution: Record<string, number> } {
    const distribution: Record<string, number> = {}
    
    this.vectors.forEach(v => {
      distribution[v.metadata.intent] = (distribution[v.metadata.intent] || 0) + 1
    })

    return {
      totalVectors: this.vectors.length,
      intentDistribution: distribution
    }
  }

  /**
   * Clear all vectors (for testing)
   */
  clear(): void {
    this.vectors = []
    this.vectorCache.clear()
  }

  /**
   * Load examples from seed data
   */
  async loadSeedExamples(): Promise<void> {
    const seedExamples = [
      // General questions
      { query: "What is machine learning?", intent: "ask", confidence: 0.9 },
      { query: "How does photosynthesis work?", intent: "ask", confidence: 0.9 },
      { query: "Explain quantum computing", intent: "ask", confidence: 0.9 },
      
      // Biographical questions (general knowledge)
      { query: "Who is Daniel Ek?", intent: "ask", confidence: 0.9 },
      { query: "Who is Steve Jobs?", intent: "ask", confidence: 0.9 },
      { query: "Who founded Apple?", intent: "ask", confidence: 0.9 },
      { query: "Who is Elon Musk?", intent: "ask", confidence: 0.9 },
      { query: "Who is the CEO of Microsoft?", intent: "ask", confidence: 0.9 },
      { query: "Who created Facebook?", intent: "ask", confidence: 0.9 },
      
      // Web search queries
      { query: "What's the latest news about Tesla?", intent: "web_search", confidence: 0.9 },
      { query: "Current stock prices for Apple", intent: "web_search", confidence: 0.9 },
      { query: "What is the current stock price of Spotify?", intent: "web_search", confidence: 0.9 },
      { query: "How much is Tesla stock trading at?", intent: "web_search", confidence: 0.9 },
      { query: "What's the current price of Microsoft stock?", intent: "web_search", confidence: 0.9 },
      { query: "Today's weather in New York", intent: "web_search", confidence: 0.9 },
      { query: "Breaking news about AI", intent: "web_search", confidence: 0.9 },
      { query: "Did Daniel Ek step down as CEO?", intent: "web_search", confidence: 0.9 },
      { query: "Did Steve Jobs leave Apple?", intent: "web_search", confidence: 0.9 },
      { query: "Is Elon Musk still CEO of Tesla?", intent: "web_search", confidence: 0.9 },
      { query: "Did Bill Gates retire from Microsoft?", intent: "web_search", confidence: 0.9 },
      { query: "Has Mark Zuckerberg stepped down from Facebook?", intent: "web_search", confidence: 0.9 },
      
      // RAG queries
      { query: "What does my research document say about climate change?", intent: "rag_query", confidence: 0.9 },
      { query: "According to my notes, what are the key findings?", intent: "rag_query", confidence: 0.9 },
      { query: "Summarize the content in this file", intent: "rag_query", confidence: 0.9 },
      { query: "What information is in my uploaded document?", intent: "rag_query", confidence: 0.9 },
      
      // Edit requests
      { query: "Rewrite this paragraph to be more concise", intent: "edit_request", confidence: 0.9 },
      { query: "Improve the grammar in this text", intent: "edit_request", confidence: 0.9 },
      { query: "Make this more professional", intent: "edit_request", confidence: 0.9 },
      { query: "Fix the spelling errors", intent: "edit_request", confidence: 0.9 },
      { query: "Polish this content", intent: "edit_request", confidence: 0.9 },
      
      // Writing tasks
      { query: "Write an essay about renewable energy", intent: "editor_write", confidence: 0.9 },
      { query: "Create a business proposal", intent: "editor_write", confidence: 0.9 },
      { query: "Draft a memo about the meeting", intent: "editor_write", confidence: 0.9 },
      { query: "Generate a report on market trends", intent: "editor_write", confidence: 0.9 },
      { query: "Compose a letter to the editor", intent: "editor_write", confidence: 0.9 }
    ]

    console.log('🌱 Loading seed examples for embedding service...')
    
    for (const example of seedExamples) {
      await this.addExample(example.query, example.intent, example.confidence)
    }
    
    console.log(`✅ Loaded ${seedExamples.length} seed examples`)
  }
}

// Export singleton
export const embeddingService = EmbeddingService.getInstance()
