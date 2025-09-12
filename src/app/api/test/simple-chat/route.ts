import { NextResponse } from "next/server"
import { generateChatCompletion, ChatMessage } from "@/lib/ai"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { message = 'Hello' } = body

        console.log('Simple chat test with message:', message)

        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: 'You are a helpful assistant. Answer the user\'s question directly and concisely.'
            },
            {
                role: 'user',
                content: message
            }
        ]

        console.log('Sending to OpenAI...')
        const response = await generateChatCompletion(messages, {
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            max_tokens: 500
        })

        console.log('Response received:', response)
        const aiMessage = response.choices[0]?.message?.content || 'No response'

        return NextResponse.json({
            success: true,
            message: aiMessage,
            usage: response.usage
        })
    } catch (error) {
        console.error('Simple chat test error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Simple chat test failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
