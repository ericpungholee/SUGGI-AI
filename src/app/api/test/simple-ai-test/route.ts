import { NextResponse } from "next/server"
import { searchWeb, formatSearchResultsForAI } from "@/lib/ai"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { message = 'who is chamath' } = body

        console.log('Testing simple AI components with message:', message)

        // Test web search
        const webResults = await searchWeb(message, { limit: 3 })
        console.log('Web search results:', webResults)

        // Test formatting
        const formatted = formatSearchResultsForAI(webResults)
        console.log('Formatted results:', formatted)

        // Test general knowledge query detection
        const isGeneralQuery = message.toLowerCase().includes('who is') || 
                              message.toLowerCase().includes('what is') ||
                              message.toLowerCase().includes('chamath')

        return NextResponse.json({
            success: true,
            message,
            webResults,
            formatted,
            isGeneralQuery,
            resultCount: webResults.length
        })
    } catch (error) {
        console.error('Simple AI test error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Simple AI test failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
