import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ragMonitor, getRAGPerformanceStats } from '@/lib/ai/rag-evaluation'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')
    const action = searchParams.get('action') || 'stats'

    switch (action) {
      case 'stats':
        const stats = ragMonitor.getRecentPerformance(hours)
        return NextResponse.json({
          success: true,
          data: stats
        })

      case 'alerts':
        const alerts = ragMonitor.getAlerts()
        return NextResponse.json({
          success: true,
          data: { alerts }
        })

      case 'performance':
        const performance = await getRAGPerformanceStats(session.user.id, Math.ceil(hours / 24))
        return NextResponse.json({
          success: true,
          data: performance
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in RAG monitoring API:', error)
    return NextResponse.json(
      { error: 'Failed to get RAG monitoring data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { query, satisfaction } = body

    if (!query || typeof satisfaction !== 'number') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    // Update user satisfaction for the most recent query
    // This would typically be stored in a database
    console.log('User satisfaction feedback:', {
      userId: session.user.id,
      query,
      satisfaction
    })

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded successfully'
    })
  } catch (error) {
    console.error('Error recording user feedback:', error)
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    )
  }
}
