import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hybridLearnedRouter } from '@/lib/ai/hybrid-learned-router'
import { embeddingService } from '@/lib/ai/embedding-service'
import { learnedClassifier } from '@/lib/ai/learned-classifier'
import { routerService } from '@/lib/ai/router-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🔍 AI System Status Check:', {
      userId: session.user.id,
      timestamp: new Date().toISOString()
    })

    // Get comprehensive system status
    const systemStatus = hybridLearnedRouter.getStatus()
    const routerMetrics = routerService.getMetrics()
    const embeddingStats = embeddingService.getStats()
    const classifierStatus = learnedClassifier.getStatus()

    // Test each component
    const componentTests = {
      hybridRouter: {
        status: systemStatus.initialized ? 'healthy' : 'initializing',
        details: systemStatus
      },
      embeddingService: {
        status: 'healthy',
        details: embeddingStats
      },
      learnedClassifier: {
        status: classifierStatus.isTrained ? 'healthy' : 'training',
        details: classifierStatus
      },
      routerService: {
        status: 'healthy',
        details: {
          totalRequests: routerMetrics.total_requests,
          averageConfidence: routerMetrics.average_confidence,
          intentDistribution: routerMetrics.intent_distribution
        }
      }
    }

    // Overall system health
    const allHealthy = Object.values(componentTests).every(comp => comp.status === 'healthy')
    const overallStatus = allHealthy ? 'healthy' : 'degraded'

    // Performance metrics
    const performanceMetrics = {
      averageProcessingTime: routerMetrics.performance_stats?.avg_time || 0,
      maxProcessingTime: routerMetrics.performance_stats?.max_time || 0,
      minProcessingTime: routerMetrics.performance_stats?.min_time || 0,
      totalRequests: routerMetrics.total_requests,
      averageConfidence: routerMetrics.average_confidence
    }

    // Intent distribution
    const intentDistribution = routerMetrics.intent_distribution || {}

    // Method distribution (from learned router metrics)
    const learnedMetrics = routerMetrics.learned_router || {}
    const methodDistribution = {
      embeddingHits: learnedMetrics.embeddingHits || 0,
      classifierHits: learnedMetrics.classifierHits || 0,
      metaClassifierHits: learnedMetrics.metaClassifierHits || 0
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      overallStatus,
      systemHealth: {
        hybridRouter: componentTests.hybridRouter.status,
        embeddingService: componentTests.embeddingService.status,
        learnedClassifier: componentTests.learnedClassifier.status,
        routerService: componentTests.routerService.status
      },
      performance: performanceMetrics,
      intentDistribution,
      methodDistribution,
      components: componentTests,
      recommendations: generateRecommendations(componentTests, performanceMetrics)
    }

    console.log('✅ AI System Status:', {
      overallStatus,
      totalRequests: performanceMetrics.totalRequests,
      averageConfidence: performanceMetrics.averageConfidence,
      methodDistribution
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ AI System Status Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch AI system status',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

function generateRecommendations(components: any, performance: any): string[] {
  const recommendations: string[] = []

  // Check component health
  if (components.hybridRouter.status !== 'healthy') {
    recommendations.push('Initialize the hybrid learned router system')
  }

  if (components.learnedClassifier.status !== 'healthy') {
    recommendations.push('Retrain the learned classifier with more data')
  }

  // Check performance
  if (performance.averageProcessingTime > 1000) {
    recommendations.push('Consider optimizing processing time - current average is high')
  }

  if (performance.averageConfidence < 0.7) {
    recommendations.push('Router confidence is low - consider adding more training examples')
  }

  // Check method distribution
  const totalHits = (components.routerService.details.methodDistribution?.embeddingHits || 0) +
                   (components.routerService.details.methodDistribution?.classifierHits || 0) +
                   (components.routerService.details.methodDistribution?.metaClassifierHits || 0)

  if (totalHits > 0) {
    const metaClassifierRatio = (components.routerService.details.methodDistribution?.metaClassifierHits || 0) / totalHits
    if (metaClassifierRatio > 0.3) {
      recommendations.push('High LLM fallback usage - consider improving classifier training')
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('System is operating optimally')
  }

  return recommendations
}
