import { NextResponse } from "next/server"
import { createEmbedding } from "@/lib/ai"

export async function POST(request: Request) {
    try {
        const { text } = await request.json()

        if (!text) {
            return NextResponse.json(
                { error: "Text is required" },
                { status: 400 }
            )
        }

        console.log('Testing embedding generation for text:', text.substring(0, 50) + '...')
        
        // Test embedding generation
        const embedding = await createEmbedding(text)
        
        return NextResponse.json({
            success: true,
            message: "Embedding generated successfully",
            embedding: {
                length: embedding.embedding.length,
                firstFew: embedding.embedding.slice(0, 5),
                tokenCount: embedding.tokenCount
            }
        })
    } catch (error) {
        console.error('Embedding test error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Embedding generation failed', 
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
