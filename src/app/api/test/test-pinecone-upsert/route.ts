import { NextResponse } from "next/server"
import { vectorDB } from "@/lib/ai/vector-db"

export async function POST() {
    try {
        // Test upserting a simple document
        const testDocument = {
            id: 'test-doc-1',
            content: 'This is a test document for Pinecone.',
            metadata: {
                documentId: 'test-doc-1',
                documentTitle: 'Test Document',
                userId: 'test-user',
                chunkIndex: 0,
                createdAt: new Date().toISOString()
            }
        }

        console.log('Upserting test document to Pinecone...')
        await vectorDB.upsertDocuments([testDocument])
        console.log('Test document upserted successfully')

        // Get stats
        const stats = await vectorDB.getDocumentStats('')
        console.log('Pinecone stats after upsert:', stats)

        return NextResponse.json({
            success: true,
            message: "Test document upserted successfully",
            stats: stats
        })
    } catch (error) {
        console.error('Pinecone upsert test error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Pinecone upsert test failed', 
                details: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
