import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { generateChatCompletion } from "@/lib/ai/openai"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Simple AI chat without document context
    const messages = [
      {
        role: 'system' as const,
        content: 'You are a helpful AI assistant. Respond briefly and helpfully.'
      },
      {
        role: 'user' as const,
        content: message.trim()
      }
    ]

    console.log('Sending request to OpenAI...')
    const response = await generateChatCompletion(messages, {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 500
    })

    const aiMessage = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.'

    return NextResponse.json({
      success: true,
      message: aiMessage,
      conversationId: 'test-conversation',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Simple AI chat error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
