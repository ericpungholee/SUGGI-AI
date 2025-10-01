/**
 * Stateless Router Service
 * Provides a clean API for intent classification with observability
 */

import { hybridLearnedRouter } from './hybrid-learned-router'
import { RouterContext, RouterResponse } from './intent-schema'

export class RouterService {
  private static instance: RouterService
  private metrics: Map<string, any> = new Map()

  static getInstance(): RouterService {
    if (!RouterService.instance) {
      RouterService.instance = new RouterService()
    }
    return RouterService.instance
  }

  /**
   * Classify user intent with full context
   */
  async classifyIntent(
    query: string,
    context: RouterContext
  ): Promise<RouterResponse> {
    const startTime = Date.now()
    
    try {
      const result = await hybridLearnedRouter.classifyIntent(query, context)
      
      // Log metrics
      this.logMetrics({
        query_length: query.length,
        processing_time: result.processing_time,
        confidence: result.classification.confidence,
        intent: result.classification.intent,
        fallback_used: result.fallback_used,
        has_docs: context.has_attached_docs,
        selection_present: context.is_selection_present,
        method: result.explanation?.method || 'unknown'
      })

      return result
    } catch (error) {
      console.error('Router service error:', error)
      
      // Return safe fallback
      return {
        classification: {
          intent: 'ask',
          confidence: 0.3,
          slots: {
            topic: null,
            needs_recency: false,
            target_docs: [],
            edit_target: null,
            outputs: 'answer'
          }
        },
        features: {
          has_docs: context.has_attached_docs,
          max_sim: 0,
          volatile: false,
          recent_tools: context.recent_tools,
          selection_present: context.is_selection_present,
          conversation_context: context.conversation_length > 0
        },
        processing_time: Date.now() - startTime,
        fallback_used: true
      }
    }
  }

  /**
   * Quick classification for simple cases
   */
  async quickClassify(
    query: string,
    hasDocs: boolean = false,
    hasSelection: boolean = false
  ): Promise<{ intent: string; confidence: number }> {
    const context: RouterContext = {
      has_attached_docs: hasDocs,
      doc_ids: [],
      is_selection_present: hasSelection,
      selection_length: 0,
      recent_tools: [],
      conversation_length: 0,
      user_id: 'quick'
    }

    const result = await this.classifyIntent(query, context)
    return {
      intent: result.classification.intent,
      confidence: result.classification.confidence
    }
  }

  /**
   * Get router metrics
   */
  getMetrics(): any {
    const learnedMetrics = hybridLearnedRouter.getMetrics()
    
    return {
      total_requests: this.metrics.size,
      average_confidence: this.calculateAverageConfidence(),
      intent_distribution: this.calculateIntentDistribution(),
      performance_stats: this.calculatePerformanceStats(),
      learned_router: learnedMetrics,
      system_status: hybridLearnedRouter.getStatus()
    }
  }

  /**
   * Clear metrics (for testing)
   */
  clearMetrics(): void {
    this.metrics.clear()
  }

  private logMetrics(data: any): void {
    const key = `${Date.now()}-${Math.random()}`
    this.metrics.set(key, data)
    
    // Keep only last 1000 entries
    if (this.metrics.size > 1000) {
      const firstKey = this.metrics.keys().next().value
      this.metrics.delete(firstKey)
    }
  }

  private calculateAverageConfidence(): number {
    const values = Array.from(this.metrics.values())
    if (values.length === 0) return 0
    
    const total = values.reduce((sum, v) => sum + (v.confidence || 0), 0)
    return total / values.length
  }

  private calculateIntentDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {}
    const values = Array.from(this.metrics.values())
    
    values.forEach(v => {
      const intent = v.intent || 'unknown'
      distribution[intent] = (distribution[intent] || 0) + 1
    })
    
    return distribution
  }

  private calculatePerformanceStats(): any {
    const values = Array.from(this.metrics.values())
    if (values.length === 0) return { avg_time: 0, max_time: 0, min_time: 0 }
    
    const times = values.map(v => v.processing_time || 0)
    return {
      avg_time: times.reduce((a, b) => a + b, 0) / times.length,
      max_time: Math.max(...times),
      min_time: Math.min(...times)
    }
  }
}

// Export singleton
export const routerService = RouterService.getInstance()
