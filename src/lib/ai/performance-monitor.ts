import { prisma } from '@/lib/prisma'

export interface PerformanceMetrics {
  operation: string
  documentId: string
  startTime: number
  endTime: number
  duration: number
  chunksProcessed: number
  chunksAdded: number
  chunksUpdated: number
  chunksDeleted: number
  memoryUsage?: number
  error?: string
}

export interface SystemPerformanceStats {
  totalOperations: number
  averageDuration: number
  totalChunksProcessed: number
  operationsPerMinute: number
  errorRate: number
  memoryUsage: {
    average: number
    peak: number
  }
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private maxMetrics = 1000 // Keep last 1000 operations

  /**
   * Start timing an operation
   */
  startOperation(operation: string, documentId: string): string {
    const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const metric: PerformanceMetrics = {
      operation,
      documentId,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      chunksProcessed: 0,
      chunksAdded: 0,
      chunksUpdated: 0,
      chunksDeleted: 0,
      memoryUsage: this.getMemoryUsage()
    }

    this.metrics.push(metric)
    
    // Keep only the last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    return operationId
  }

  /**
   * End timing an operation
   */
  endOperation(
    operationId: string,
    result: {
      chunksProcessed: number
      chunksAdded: number
      chunksUpdated: number
      chunksDeleted: number
      error?: string
    }
  ): void {
    const metric = this.metrics.find(m => 
      m.operation === operationId.split('-')[0] && 
      m.documentId === operationId.split('-')[1]
    )

    if (metric) {
      metric.endTime = Date.now()
      metric.duration = metric.endTime - metric.startTime
      metric.chunksProcessed = result.chunksProcessed
      metric.chunksAdded = result.chunksAdded
      metric.chunksUpdated = result.chunksUpdated
      metric.chunksDeleted = result.chunksDeleted
      metric.memoryUsage = this.getMemoryUsage()
      
      if (result.error) {
        metric.error = result.error
      }
    }
  }

  /**
   * Get current memory usage (Node.js)
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return usage.heapUsed / 1024 / 1024 // MB
    }
    return 0
  }

  /**
   * Get performance statistics
   */
  getStats(): SystemPerformanceStats {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000
    
    const recentMetrics = this.metrics.filter(m => m.startTime > oneMinuteAgo)
    const completedMetrics = this.metrics.filter(m => m.endTime > 0)
    const errorMetrics = completedMetrics.filter(m => m.error)

    const totalDuration = completedMetrics.reduce((sum, m) => sum + m.duration, 0)
    const totalChunksProcessed = completedMetrics.reduce((sum, m) => sum + m.chunksProcessed, 0)
    
    const memoryUsages = completedMetrics
      .filter(m => m.memoryUsage !== undefined)
      .map(m => m.memoryUsage!)

    return {
      totalOperations: completedMetrics.length,
      averageDuration: completedMetrics.length > 0 ? totalDuration / completedMetrics.length : 0,
      totalChunksProcessed,
      operationsPerMinute: recentMetrics.length,
      errorRate: completedMetrics.length > 0 ? errorMetrics.length / completedMetrics.length : 0,
      memoryUsage: {
        average: memoryUsages.length > 0 ? memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length : 0,
        peak: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0
      }
    }
  }

  /**
   * Get metrics for a specific document
   */
  getDocumentMetrics(documentId: string): PerformanceMetrics[] {
    return this.metrics.filter(m => m.documentId === documentId)
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(thresholdMs: number = 5000): PerformanceMetrics[] {
    return this.metrics.filter(m => m.duration > thresholdMs && m.endTime > 0)
  }

  /**
   * Get error metrics
   */
  getErrorMetrics(): PerformanceMetrics[] {
    return this.metrics.filter(m => m.error)
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs
    this.metrics = this.metrics.filter(m => m.startTime > cutoff)
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Decorator for automatic performance monitoring
 */
export function monitorPerformance(operation: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const documentId = args[0] // Assume first argument is documentId
      const operationId = performanceMonitor.startOperation(operation, documentId)

      try {
        const result = await method.apply(this, args)
        
        performanceMonitor.endOperation(operationId, {
          chunksProcessed: result.chunksProcessed || 0,
          chunksAdded: result.chunksAdded || 0,
          chunksUpdated: result.chunksUpdated || 0,
          chunksDeleted: result.chunksDeleted || 0
        })

        return result
      } catch (error) {
        performanceMonitor.endOperation(operationId, {
          chunksProcessed: 0,
          chunksAdded: 0,
          chunksUpdated: 0,
          chunksDeleted: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    }
  }
}

/**
 * Get system performance dashboard data
 */
export async function getPerformanceDashboard(): Promise<{
  stats: SystemPerformanceStats
  recentOperations: PerformanceMetrics[]
  slowOperations: PerformanceMetrics[]
  errorOperations: PerformanceMetrics[]
  recommendations: string[]
}> {
  const stats = performanceMonitor.getStats()
  const recentOperations = performanceMonitor.getDocumentMetrics('').slice(-10)
  const slowOperations = performanceMonitor.getSlowOperations()
  const errorOperations = performanceMonitor.getErrorMetrics()

  // Generate recommendations based on performance data
  const recommendations: string[] = []
  
  if (stats.averageDuration > 10000) {
    recommendations.push('Consider using incremental vectorization for better performance')
  }
  
  if (stats.errorRate > 0.1) {
    recommendations.push('High error rate detected - check system logs for issues')
  }
  
  if (stats.memoryUsage.peak > 1000) {
    recommendations.push('High memory usage detected - consider implementing memory optimization')
  }
  
  if (stats.operationsPerMinute > 50) {
    recommendations.push('High operation frequency - consider implementing rate limiting')
  }

  return {
    stats,
    recentOperations,
    slowOperations,
    errorOperations,
    recommendations
  }
}
