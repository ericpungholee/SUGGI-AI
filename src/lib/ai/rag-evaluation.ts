/**
 * RAG Evaluation and Monitoring System
 * Provides metrics and monitoring for RAG performance
 */

export interface RAGEvaluationMetrics {
  retrievalAccuracy: number
  responseRelevance: number
  contextUtilization: number
  responseTime: number
  tokenEfficiency: number
  overallScore: number
}

export interface QueryEvaluation {
  query: string
  timestamp: Date
  metrics: RAGEvaluationMetrics
  contextChunks: number
  responseLength: number
  userSatisfaction?: number
}

export interface RAGPerformanceStats {
  totalQueries: number
  averageAccuracy: number
  averageResponseTime: number
  averageTokenEfficiency: number
  topPerformingQueries: QueryEvaluation[]
  worstPerformingQueries: QueryEvaluation[]
  accuracyTrend: Array<{ date: string; accuracy: number }>
}

/**
 * Evaluate RAG response quality
 */
export async function evaluateRAGResponse(
  query: string,
  context: string,
  response: string,
  responseTime: number,
  contextChunks: number
): Promise<RAGEvaluationMetrics> {
  try {
    const { generateChatCompletion } = await import('./openai')
    
    // Evaluate retrieval accuracy
    const retrievalAccuracy = await evaluateRetrievalAccuracy(query, context)
    
    // Evaluate response relevance
    const responseRelevance = await evaluateResponseRelevance(query, response)
    
    // Evaluate context utilization
    const contextUtilization = evaluateContextUtilization(context, response)
    
    // Calculate token efficiency
    const tokenEfficiency = calculateTokenEfficiency(context, response)
    
    // Calculate overall score
    const overallScore = (
      retrievalAccuracy * 0.3 +
      responseRelevance * 0.3 +
      contextUtilization * 0.2 +
      tokenEfficiency * 0.2
    )

    return {
      retrievalAccuracy,
      responseRelevance,
      contextUtilization,
      responseTime,
      tokenEfficiency,
      overallScore
    }
  } catch (error) {
    console.error('Error evaluating RAG response:', error)
    return {
      retrievalAccuracy: 0.5,
      responseRelevance: 0.5,
      contextUtilization: 0.5,
      responseTime,
      tokenEfficiency: 0.5,
      overallScore: 0.5
    }
  }
}

/**
 * Evaluate how well the retrieved context matches the query
 */
async function evaluateRetrievalAccuracy(query: string, context: string): Promise<number> {
  try {
    const { generateChatCompletion } = await import('./openai')
    
    const evaluationPrompt = `Evaluate how well the retrieved context matches the user's query on a scale of 0.0 to 1.0.

User Query: "${query}"

Retrieved Context:
${context}

Consider:
1. Semantic relevance (0.0-1.0)
2. Information completeness (0.0-1.0)
3. Factual accuracy (0.0-1.0)

Respond with a single number between 0.0 and 1.0 representing the overall retrieval accuracy.`

    const response = await generateChatCompletion([
      { role: 'user', content: evaluationPrompt }
    ], {
      model: 'gpt-5-nano',
      temperature: 0.1,
      max_tokens: 50
    })

    const score = parseFloat(response.choices[0]?.message?.content?.trim() || '0.5')
    return Math.max(0, Math.min(1, score)) // Clamp between 0 and 1
  } catch (error) {
    console.error('Error evaluating retrieval accuracy:', error)
    return 0.5
  }
}

/**
 * Evaluate how relevant the response is to the query
 */
async function evaluateResponseRelevance(query: string, response: string): Promise<number> {
  try {
    const { generateChatCompletion } = await import('./openai')
    
    const evaluationPrompt = `Evaluate how well the AI response addresses the user's query on a scale of 0.0 to 1.0.

User Query: "${query}"

AI Response:
${response}

Consider:
1. Directness in answering the query (0.0-1.0)
2. Completeness of the response (0.0-1.0)
3. Clarity and usefulness (0.0-1.0)

Respond with a single number between 0.0 and 1.0 representing the overall response relevance.`

    const response_result = await generateChatCompletion([
      { role: 'user', content: evaluationPrompt }
    ], {
      model: 'gpt-5-nano',
      temperature: 0.1,
      max_tokens: 50
    })

    const score = parseFloat(response_result.choices[0]?.message?.content?.trim() || '0.5')
    return Math.max(0, Math.min(1, score)) // Clamp between 0 and 1
  } catch (error) {
    console.error('Error evaluating response relevance:', error)
    return 0.5
  }
}

/**
 * Evaluate how well the response utilizes the provided context
 */
function evaluateContextUtilization(context: string, response: string): number {
  if (!context || !response) return 0.5

  // Simple heuristic: check for overlap between context and response
  const contextWords = new Set(context.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const responseWords = new Set(response.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  
  const intersection = new Set([...contextWords].filter(x => responseWords.has(x)))
  const union = new Set([...contextWords, ...responseWords])
  
  const jaccardSimilarity = intersection.size / union.size
  
  // Also check for specific references to document sources
  const hasDocumentReferences = /document|source|reference|according to|from.*document/i.test(response)
  const referenceBonus = hasDocumentReferences ? 0.2 : 0
  
  return Math.min(1, jaccardSimilarity + referenceBonus)
}

/**
 * Calculate token efficiency (useful information per token)
 */
function calculateTokenEfficiency(context: string, response: string): number {
  const contextTokens = Math.ceil(context.length / 4)
  const responseTokens = Math.ceil(response.length / 4)
  
  if (responseTokens === 0) return 0
  
  // Simple efficiency metric: response quality per token
  // Higher is better (more useful information per token)
  const efficiency = Math.min(1, responseTokens / Math.max(1, contextTokens * 0.1))
  return efficiency
}

/**
 * Store evaluation metrics for monitoring
 */
export async function storeEvaluationMetrics(
  userId: string,
  evaluation: QueryEvaluation
): Promise<void> {
  try {
    // In a real implementation, you would store this in a database
    // For now, we'll just log it
    console.log('RAG Evaluation Metrics:', {
      userId,
      query: evaluation.query,
      metrics: evaluation.metrics,
      timestamp: evaluation.timestamp
    })
    
    // You could store this in a dedicated table like:
    // await prisma.ragEvaluation.create({
    //   data: {
    //     userId,
    //     query: evaluation.query,
    //     metrics: evaluation.metrics,
    //     contextChunks: evaluation.contextChunks,
    //     responseLength: evaluation.responseLength,
    //     userSatisfaction: evaluation.userSatisfaction,
    //     timestamp: evaluation.timestamp
    //   }
    // })
  } catch (error) {
    console.error('Error storing evaluation metrics:', error)
  }
}

/**
 * Get RAG performance statistics
 */
export async function getRAGPerformanceStats(
  userId: string,
  days: number = 30
): Promise<RAGPerformanceStats> {
  try {
    // In a real implementation, you would query the database
    // For now, return mock data
    return {
      totalQueries: 0,
      averageAccuracy: 0.75,
      averageResponseTime: 1200,
      averageTokenEfficiency: 0.65,
      topPerformingQueries: [],
      worstPerformingQueries: [],
      accuracyTrend: []
    }
  } catch (error) {
    console.error('Error getting RAG performance stats:', error)
    throw new Error('Failed to get RAG performance statistics')
  }
}

/**
 * Monitor RAG performance in real-time
 */
export class RAGMonitor {
  private metrics: QueryEvaluation[] = []
  private maxMetrics = 1000 // Keep last 1000 evaluations

  addEvaluation(evaluation: QueryEvaluation): void {
    this.metrics.push(evaluation)
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  getRecentPerformance(hours: number = 24): RAGPerformanceStats {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff)
    
    if (recentMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageAccuracy: 0,
        averageResponseTime: 0,
        averageTokenEfficiency: 0,
        topPerformingQueries: [],
        worstPerformingQueries: [],
        accuracyTrend: []
      }
    }

    const totalQueries = recentMetrics.length
    const averageAccuracy = recentMetrics.reduce((sum, m) => sum + m.metrics.overallScore, 0) / totalQueries
    const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.metrics.responseTime, 0) / totalQueries
    const averageTokenEfficiency = recentMetrics.reduce((sum, m) => sum + m.metrics.tokenEfficiency, 0) / totalQueries

    const sortedByScore = [...recentMetrics].sort((a, b) => b.metrics.overallScore - a.metrics.overallScore)
    const topPerformingQueries = sortedByScore.slice(0, 5)
    const worstPerformingQueries = sortedByScore.slice(-5).reverse()

    return {
      totalQueries,
      averageAccuracy,
      averageResponseTime,
      averageTokenEfficiency,
      topPerformingQueries,
      worstPerformingQueries,
      accuracyTrend: [] // Would need time-series data
    }
  }

  getAlerts(): string[] {
    const recent = this.getRecentPerformance(1) // Last hour
    const alerts: string[] = []

    if (recent.averageAccuracy < 0.6) {
      alerts.push('Low accuracy detected - consider reviewing retrieval strategy')
    }

    if (recent.averageResponseTime > 5000) {
      alerts.push('Slow response times detected - consider optimizing queries')
    }

    if (recent.averageTokenEfficiency < 0.4) {
      alerts.push('Low token efficiency detected - consider improving context compression')
    }

    return alerts
  }
}

// Global monitor instance
export const ragMonitor = new RAGMonitor()
