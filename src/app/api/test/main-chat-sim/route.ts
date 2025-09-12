import { NextResponse } from "next/server"
import { processAIChat } from "@/lib/ai"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { message = 'what did I invest in 2022' } = body

        console.log('Testing main chat simulation with message:', message)

        // Simulate the exact same request as the main chat endpoint
        const aiRequest = {
            message: message,
            userId: 'test-user-id',
            includeContext: true,
            abortSignal: undefined
        }

        console.log('Calling processAIChat...')
        const response = await processAIChat(aiRequest)
        console.log('processAIChat response:', response)

        return NextResponse.json({
            success: true,
            message: response.message,
            conversationId: response.conversationId,
            contextUsed: response.contextUsed,
            tokenUsage: response.tokenUsage
        })
    } catch (error) {
        console.error('Main chat simulation error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Main chat simulation failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
