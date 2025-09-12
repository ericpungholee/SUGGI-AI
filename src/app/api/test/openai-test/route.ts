import { NextResponse } from "next/server"
import { generateChatCompletion, ChatMessage } from "@/lib/ai"

export async function GET(request: Request) {
    try {
        console.log('Testing OpenAI API connection...')
        console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY)
        console.log('Model:', process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo')

        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: 'You are a helpful assistant. Respond with a simple greeting.'
            },
            {
                role: 'user',
                content: 'Hello, can you say hi?'
            }
        ]

        console.log('Sending request to OpenAI...')
        // Try with a simpler model first
        const response = await generateChatCompletion(messages, {
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            max_tokens: 100
        })

        console.log('OpenAI response received:', JSON.stringify(response, null, 2))

        return NextResponse.json({
            success: true,
            message: response.choices[0]?.message?.content || 'No content',
            usage: response.usage,
            model: response.model,
            fullResponse: response,
            choicesCount: response.choices?.length || 0,
            firstChoice: response.choices?.[0] || null
        })
    } catch (error) {
        console.error('OpenAI test error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'OpenAI test failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                name: error instanceof Error ? error.name : 'Unknown',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
