import { NextResponse } from "next/server"
import { getDocumentContext } from "@/lib/ai/vector-search"

export async function POST(request: Request) {
    try {
        const { userId, query, documentId } = await request.json()

        if (!userId || !query) {
            return NextResponse.json(
                { error: "userId and query are required" },
                { status: 400 }
            )
        }

        console.log('=== DEBUG SEARCH ===')
        console.log('User ID:', userId)
        console.log('Query:', query)
        console.log('Document ID:', documentId)

        // Test document context retrieval
        const context = await getDocumentContext(query, userId, documentId)
        
        console.log('Context retrieved:', context ? 'Yes' : 'No')
        console.log('Context length:', context?.length || 0)

        return NextResponse.json({
            success: true,
            message: "Debug search completed",
            userId,
            query,
            documentId,
            contextRetrieved: !!context,
            contextLength: context?.length || 0,
            contextPreview: context?.substring(0, 200) + '...' || 'No context'
        })
    } catch (error) {
        console.error('Debug search error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Debug search failed', 
                details: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
