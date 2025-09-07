import { NextResponse } from "next/server"
import { vectorDB } from "@/lib/ai/vector-db"

export async function POST(request: Request) {
    try {
        const { userId, documentId } = await request.json()

        if (!userId || !documentId) {
            return NextResponse.json(
                { error: "userId and documentId are required" },
                { status: 400 }
            )
        }

        console.log('=== MANUAL PINECONE TEST ===')
        console.log('User ID:', userId)
        console.log('Document ID:', documentId)

        // Initialize Pinecone
        await vectorDB.initialize()
        console.log('Pinecone initialized')

        // Test storing a simple document
        const testDocument = {
            id: `${documentId}-test-chunk`,
            content: "This is a test chunk for Pinecone storage",
            metadata: {
                documentId: documentId,
                documentTitle: "Test Document",
                userId: userId,
                chunkIndex: 0,
                createdAt: new Date().toISOString()
            }
        }

        console.log('Attempting to store test document in Pinecone...')
        await vectorDB.upsertDocuments([testDocument])
        console.log('Test document stored successfully')

        // Check stats
        const stats = await vectorDB.getDocumentStats('')
        console.log('Pinecone stats after test:', stats)

        // Test search
        const searchResults = await vectorDB.searchDocuments('test chunk', userId, {
            topK: 5,
            includeMetadata: true
        })
        console.log('Search results:', searchResults.length)

        return NextResponse.json({
            success: true,
            message: "Manual Pinecone test completed",
            stats,
            searchResults: searchResults.length
        })
    } catch (error) {
        console.error('Manual Pinecone test error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Manual Pinecone test failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
