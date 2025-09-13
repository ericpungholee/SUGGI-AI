import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { processAIEdit, AIEditRequest } from "@/lib/ai/ai-edit"

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
        const { 
            content, 
            selection, 
            intent,
            documentId,
            operationId 
        } = body

        if (!content || typeof content !== 'string') {
            return NextResponse.json(
                { error: "Content is required" },
                { status: 400 }
            )
        }

        const aiRequest: AIEditRequest = {
            content: content.trim(),
            selection: selection || null,
            intent: intent || 'improve writing',
            userId: session.user.id,
            documentId: documentId || null,
            operationId: operationId || null
        }

        try {
            const response = await processAIEdit(aiRequest)
            
            return NextResponse.json(response)
        } catch (error) {
            console.error('AI edit processing failed:', error)
            
            if (error instanceof Error && error.message.includes('cancelled')) {
                return NextResponse.json(
                    { 
                        error: 'Operation was cancelled',
                        cancelled: true 
                    },
                    { status: 200 }
                )
            }
            
            return NextResponse.json(
                { error: "Failed to process AI edit request" },
                { status: 500 }
            )
        }
    } catch (error) {
        console.error('AI edit API error:', error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
