import { NextResponse } from "next/server"
import { searchWeb, formatSearchResultsForAI } from "@/lib/ai"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q') || 'who is chamath'

        console.log('Testing web search with query:', query)

        // Test web search
        const results = await searchWeb(query, { limit: 3 })
        console.log('Web search results:', results)

        // Test formatting
        const formatted = formatSearchResultsForAI(results)
        console.log('Formatted results:', formatted)

        return NextResponse.json({
            success: true,
            query,
            results,
            formatted,
            resultCount: results.length
        })
    } catch (error) {
        console.error('Web search test error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Web search test failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
