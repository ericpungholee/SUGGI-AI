import { NextResponse } from "next/server"
import { vectorDB } from "@/lib/ai/vector-db"

export async function GET(request: Request) {
    try {
        console.log('Testing Pinecone connection...')
        
        // Test Pinecone initialization
        await vectorDB.initialize()
        
        // Test getting stats
        const stats = await vectorDB.getDocumentStats('')
        
        return NextResponse.json({
            success: true,
            message: "Pinecone is working!",
            stats,
            environment: {
                hasApiKey: !!process.env.PINECONE_API_KEY,
                indexName: process.env.PINECONE_INDEX_NAME || 'ssugi-documents'
            }
        })
    } catch (error) {
        console.error('Pinecone test error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Pinecone test failed', 
                details: error instanceof Error ? error.message : 'Unknown error',
                environment: {
                    hasApiKey: !!process.env.PINECONE_API_KEY,
                    indexName: process.env.PINECONE_INDEX_NAME || 'ssugi-documents'
                }
            },
            { status: 500 }
        )
    }
}
