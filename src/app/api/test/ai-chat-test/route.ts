import { NextResponse } from "next/server"
import { processAIChat } from "@/lib/ai"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { message = 'who is chamath' } = body

        console.log('Testing AI chat with message:', message)

        // Create a mock request for testing
        const aiRequest = {
            message: message,
            userId: 'test-user-id',
            includeContext: true,
            abortSignal: undefined
        }

        const response = await processAIChat(aiRequest)
        console.log('AI chat response:', response)

        return NextResponse.json({
            success: true,
            message: response.message,
            conversationId: response.conversationId,
            contextUsed: response.contextUsed,
            tokenUsage: response.tokenUsage
        })
    } catch (error) {
        console.error('AI chat test error:', error)
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        return NextResponse.json(
            { 
                success: false, 
                error: 'AI chat test failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
