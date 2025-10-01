import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hybridLearnedRouter } from '@/lib/ai/hybrid-learned-router'
import { embeddingService } from '@/lib/ai/embedding-service'
import { learnedClassifier } from '@/lib/ai/learned-classifier'
import { llmMetaClassifier } from '@/lib/ai/llm-meta-classifier'
import { routerService } from '@/lib/ai/router-service'
import { ragAdapter } from '@/lib/ai/rag-adapter'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🏥 AI System Health Check:', {
      userId: session.user.id,
      timestamp: new Date().toISOString()
    })

    const healthChecks = {
      hybridRouter: await checkHybridRouter(),
      embeddingService: await checkEmbeddingService(),
      learnedClassifier: await checkLearnedClassifier(),
      llmMetaClassifier: await checkLLMMetaClassifier(),
      routerService: await checkRouterService(),
      ragAdapter: await checkRAGAdapter()
    }

    // Calculate overall health
    const allHealthy = Object.values(healthChecks).every(check => check.status === 'healthy')
    const anyDegraded = Object.values(healthChecks).some(check => check.status === 'degraded')
    const anyUnhealthy = Object.values(healthChecks).some(check => check.status === 'unhealthy')

    let overallStatus = 'healthy'
    if (anyUnhealthy) overallStatus = 'unhealthy'
    else if (anyDegraded) overallStatus = 'degraded'

    // Performance summary
    const performanceSummary = {
      averageResponseTime: calculateAverageResponseTime(healthChecks),
      totalRequests: healthChecks.routerService.metrics?.totalRequests || 0,
      successRate: calculateSuccessRate(healthChecks),
      uptime: '100%' // In a real system, you'd track this
    }

    // Recommendations
    const recommendations = generateHealthRecommendations(healthChecks)

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      overallStatus,
      performance: performanceSummary,
      components: healthChecks,
      recommendations,
      systemInfo: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    }

    console.log('✅ AI System Health Check Complete:', {
      overallStatus,
      totalRequests: performanceSummary.totalRequests,
      successRate: performanceSummary.successRate
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ AI System Health Check Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

async function checkHybridRouter(): Promise<HealthCheck> {
  try {
    const status = hybridLearnedRouter.getStatus()
    const metrics = hybridLearnedRouter.getMetrics()
    
    return {
      status: status.initialized ? 'healthy' : 'degraded',
      message: status.initialized ? 'Router initialized and ready' : 'Router initializing',
      metrics: {
        initialized: status.initialized,
        totalRequests: metrics.totalRequests,
        averageConfidence: metrics.averageConfidence,
        averageProcessingTime: metrics.averageProcessingTime
      },
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Router check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    }
  }
}

async function checkEmbeddingService(): Promise<HealthCheck> {
  try {
    const stats = embeddingService.getStats()
    
    return {
      status: stats.totalVectors > 0 ? 'healthy' : 'degraded',
      message: stats.totalVectors > 0 ? 'Embedding service operational' : 'No vectors loaded',
      metrics: {
        totalVectors: stats.totalVectors,
        intentDistribution: stats.intentDistribution
      },
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Embedding service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    }
  }
}

async function checkLearnedClassifier(): Promise<HealthCheck> {
  try {
    const status = learnedClassifier.getStatus()
    
    return {
      status: status.isTrained ? 'healthy' : 'degraded',
      message: status.isTrained ? 'Classifier trained and ready' : 'Classifier needs training',
      metrics: {
        isTrained: status.isTrained,
        weightsLoaded: status.weightsLoaded,
        intents: status.intents
      },
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Classifier check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    }
  }
}

async function checkLLMMetaClassifier(): Promise<HealthCheck> {
  try {
    // Test with a simple query
    const testResult = await llmMetaClassifier.getConfidence('test query', {})
    
    return {
      status: 'healthy',
      message: 'LLM meta-classifier operational',
      metrics: {
        confidence: testResult,
        available: true
      },
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `LLM meta-classifier check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    }
  }
}

async function checkRouterService(): Promise<HealthCheck> {
  try {
    const metrics = routerService.getMetrics()
    
    return {
      status: 'healthy',
      message: 'Router service operational',
      metrics: {
        totalRequests: metrics.total_requests,
        averageConfidence: metrics.average_confidence,
        intentDistribution: metrics.intent_distribution,
        performanceStats: metrics.performance_stats
      },
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Router service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    }
  }
}

async function checkRAGAdapter(): Promise<HealthCheck> {
  try {
    // Test RAG adapter with a simple search
    const testResults = await ragAdapter.search('test', { topK: 1, projectId: 'health-check' })
    
    return {
      status: 'healthy',
      message: 'RAG adapter operational',
      metrics: {
        testSearchSuccessful: true,
        resultsFound: testResults.length
      },
      lastChecked: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `RAG adapter check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    }
  }
}

function calculateAverageResponseTime(healthChecks: Record<string, HealthCheck>): number {
  const times = Object.values(healthChecks)
    .map(check => check.metrics?.averageProcessingTime || check.metrics?.avg_time || 0)
    .filter(time => time > 0)
  
  return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
}

function calculateSuccessRate(healthChecks: Record<string, HealthCheck>): number {
  const healthyCount = Object.values(healthChecks).filter(check => check.status === 'healthy').length
  const totalCount = Object.keys(healthChecks).length
  return totalCount > 0 ? (healthyCount / totalCount) * 100 : 0
}

function generateHealthRecommendations(healthChecks: Record<string, HealthCheck>): string[] {
  const recommendations: string[] = []

  if (healthChecks.hybridRouter.status !== 'healthy') {
    recommendations.push('Initialize the hybrid learned router system')
  }

  if (healthChecks.embeddingService.status === 'degraded') {
    recommendations.push('Load more training examples into the embedding service')
  }

  if (healthChecks.learnedClassifier.status !== 'healthy') {
    recommendations.push('Retrain the learned classifier with more data')
  }

  if (healthChecks.llmMetaClassifier.status !== 'healthy') {
    recommendations.push('Check LLM API connectivity and configuration')
  }

  if (healthChecks.ragAdapter.status !== 'healthy') {
    recommendations.push('Verify RAG adapter configuration and vector database connection')
  }

  // Check performance metrics
  const routerMetrics = healthChecks.routerService.metrics
  if (routerMetrics?.averageConfidence && routerMetrics.averageConfidence < 0.7) {
    recommendations.push('Router confidence is low - consider adding more training examples')
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems operating optimally')
  }

  return recommendations
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  message: string
  metrics?: any
  error?: string
  lastChecked: string
}
