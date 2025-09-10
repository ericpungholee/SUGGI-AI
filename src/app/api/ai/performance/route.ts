import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerformanceDashboard, performanceMonitor } from '@/lib/ai/performance-monitor'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')
    const action = searchParams.get('action')

    if (action === 'dashboard') {
      const dashboard = await getPerformanceDashboard()
      return NextResponse.json({
        success: true,
        dashboard
      })
    }

    if (action === 'document' && documentId) {
      const metrics = performanceMonitor.getDocumentMetrics(documentId)
      return NextResponse.json({
        success: true,
        documentId,
        metrics
      })
    }

    if (action === 'slow') {
      const threshold = parseInt(searchParams.get('threshold') || '5000')
      const slowOperations = performanceMonitor.getSlowOperations(threshold)
      return NextResponse.json({
        success: true,
        slowOperations,
        threshold
      })
    }

    if (action === 'errors') {
      const errorOperations = performanceMonitor.getErrorMetrics()
      return NextResponse.json({
        success: true,
        errorOperations
      })
    }

    if (action === 'export') {
      const metrics = performanceMonitor.exportMetrics()
      return NextResponse.json({
        success: true,
        metrics,
        count: metrics.length
      })
    }

    if (action === 'clear') {
      const olderThan = parseInt(searchParams.get('olderThan') || '86400000') // 24 hours
      performanceMonitor.clearOldMetrics(olderThan)
      return NextResponse.json({
        success: true,
        message: 'Old metrics cleared'
      })
    }

    // Default: return basic stats
    const stats = performanceMonitor.getStats()
    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Error getting performance data:', error)
    return NextResponse.json(
      { error: 'Failed to get performance data' },
      { status: 500 }
    )
  }
}
