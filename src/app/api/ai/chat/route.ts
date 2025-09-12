import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { processAIChat, AIChatRequest } from "@/lib/ai"
import { registerOperation, unregisterOperation } from "./cancel/route"

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { message, documentId, conversationId, includeContext = true, useWebSearch = false, operationId } = body

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            )
        }

        // Create abort controller for cancellation
        const abortController = new AbortController()
        
        // Register operation for cancellation if operationId is provided
        if (operationId) {
            registerOperation(operationId, abortController)
        }

        const aiRequest: AIChatRequest = {
            message: message.trim(),
            userId: session.user.id,
            documentId,
            conversationId,
            includeContext,
            useWebSearch,
            abortSignal: abortController.signal
        }

        try {
            const response = await processAIChat(aiRequest)
            
            // Unregister operation on completion
            if (operationId) {
                unregisterOperation(operationId)
            }
            
            return NextResponse.json(response)
        } catch (error) {
            // Unregister operation on error
            if (operationId) {
                unregisterOperation(operationId)
            }
            
            // Check if it was cancelled
            if (error instanceof Error && error.message.includes('cancelled')) {
                return NextResponse.json({
                    message: 'Operation was cancelled',
                    conversationId: conversationId || '',
                    cancelled: true
                })
            }
            
            throw error
        }
    } catch (error) {
        console.error('AI chat API error:', error)
        return NextResponse.json(
            { error: 'Failed to process AI chat request' },
            { status: 500 }
        )
    }
}

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(request.url)
        const conversationId = searchParams.get('conversationId')
        const limit = parseInt(searchParams.get('limit') || '50')

        if (!conversationId) {
            return NextResponse.json(
                { error: "Conversation ID is required" },
                { status: 400 }
            )
        }

        const { getConversationHistory } = await import("@/lib/ai")
        const messages = await getConversationHistory(conversationId, session.user.id, limit)

        return NextResponse.json({ messages })
    } catch (error) {
        console.error('AI chat history API error:', error)
        return NextResponse.json(
            { error: 'Failed to get conversation history' },
            { status: 500 }
        )
    }
}
