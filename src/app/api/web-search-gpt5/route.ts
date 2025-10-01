import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { performWebSearch, streamWebSearch } from '@/lib/ai/gpt5-web-search-simple'
import { routerService } from '@/lib/ai/router-service'
import { RouterContext } from '@/lib/ai/intent-schema'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { query, context, stream = false } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    console.log('🔍 GPT-5 Web Search Request:', {
      userId: session.user.id,
      query,
      stream,
      hasContext: !!context
    })

    // Use hybrid router to classify the query
    const routerContext: RouterContext = {
      has_attached_docs: context?.has_attached_docs || false,
      doc_ids: context?.doc_ids || [],
      is_selection_present: context?.is_selection_present || false,
      selection_length: context?.selection_length || 0,
      recent_tools: context?.recent_tools || [],
      conversation_length: context?.conversation_length || 0,
      user_id: session.user.id,
      document_id: context?.document_id
    }

    const routerResult = await routerService.classifyIntent(query, routerContext)
    
    console.log('🔍 Web Search Router Classification:', {
      intent: routerResult.classification.intent,
      confidence: routerResult.classification.confidence,
      method: (routerResult as any).explanation?.method || 'unknown',
      needsRecency: routerResult.classification.slots.needs_recency
    })

    // Always perform web search if router suggests it
    // The GPT-5 model will decide whether to actually use the web_search tool
    if (routerResult.classification.intent !== 'web_search') {
      return NextResponse.json({
        error: 'Query does not require web search',
        intent: routerResult.classification.intent,
        confidence: routerResult.classification.confidence
      }, { status: 400 })
    }

    // Perform web search
    if (stream) {
      // Return streaming response
      const stream = await streamWebSearch(query, {
        force_web_search: routerResult.classification.intent === 'web_search',
        timeout_seconds: 20,
        max_attempts: 45
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    } else {
      // Return complete response
      const result = await performWebSearch(query, {
        force_web_search: routerResult.classification.intent === 'web_search',
        timeout_seconds: 15, // Faster timeout for better UX
      })

      return NextResponse.json({
        success: true,
        query,
        text: result.text,
        citations: result.citations,
        usage: result.usage,
        router: {
          intent: routerResult.classification.intent,
          confidence: routerResult.classification.confidence,
          method: (routerResult as any).explanation?.method || 'unknown',
          reasoning: (routerResult as any).explanation?.reasoning,
          processingTime: routerResult.processing_time,
          fallbackUsed: routerResult.fallback_used
        },
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('❌ GPT-5 Web Search Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Web search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

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
    const query = searchParams.get('query')
    const stream = searchParams.get('stream') === 'true'

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    // Simple web search without router classification for testing
    const result = await performWebSearch(query, {
      force_web_search: true,
      timeout_seconds: 20, // Reasonable timeout for web search
    })

    if (stream) {
      const stream = await streamWebSearch(query, {
        force_web_search: true,
        timeout_seconds: 20,
        max_attempts: 45
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    }

    return NextResponse.json({
      success: true,
      query,
      text: result.text,
      citations: result.citations,
      usage: result.usage,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ GPT-5 Web Search GET Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Web search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
