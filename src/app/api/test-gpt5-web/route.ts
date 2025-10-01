import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { performWebSearch } from '@/lib/ai/gpt5-web-search'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || 'What is the latest news about AI?'

    console.log('🧪 Testing GPT-5 Web Search:', {
      userId: session.user.id,
      query,
      timestamp: new Date().toISOString()
    })

    const result = await performWebSearch(query, {
      force_web_search: true
    })

    return NextResponse.json({
      success: true,
      query,
      result: {
        text: result.text,
        citations: result.citations,
        usage: result.usage
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ GPT-5 Web Search Test Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
