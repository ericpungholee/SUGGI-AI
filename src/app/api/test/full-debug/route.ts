import { NextResponse } from "next/server"
import { searchSimilarDocuments } from "@/lib/ai/vector-search"
import { vectorDB } from "@/lib/ai/vector-db"

export async function POST(request: Request) {
    try {
        const { userId, query, documentId } = await request.json()

        if (!userId || !query) {
            return NextResponse.json(
                { error: "userId and query are required" },
                { status: 400 }
            )
        }

        console.log('=== FULL DEBUG TEST ===')
        console.log('User ID:', userId)
        console.log('Query:', query)
        console.log('Document ID:', documentId)

        // Test 1: Check Pinecone stats
        console.log('\n--- Test 1: Pinecone Stats ---')
        try {
            const stats = await vectorDB.getDocumentStats('')
            console.log('Pinecone stats (all users):', stats)
        } catch (error) {
            console.error('Pinecone stats error:', error)
        }

        // Test 2: Check Pinecone stats for specific user
        console.log('\n--- Test 2: Pinecone Stats for User ---')
        try {
            const userStats = await vectorDB.getDocumentStats(userId)
            console.log('Pinecone stats for user:', userStats)
        } catch (error) {
            console.error('Pinecone user stats error:', error)
        }

        // Test 3: Direct Pinecone search
        console.log('\n--- Test 3: Direct Pinecone Search ---')
        try {
            const pineconeResults = await vectorDB.searchDocuments(query, userId, {
                topK: 5,
                includeMetadata: true
            })
            console.log('Direct Pinecone results:', pineconeResults.length)
            console.log('Pinecone scores:', pineconeResults.map(r => r.score))
        } catch (error) {
            console.error('Direct Pinecone search error:', error)
        }

        // Test 4: Search similar documents
        console.log('\n--- Test 4: Search Similar Documents ---')
        try {
            const searchResults = await searchSimilarDocuments(query, userId, {
                limit: 5,
                threshold: 0.1, // Very low threshold for testing
                includeContent: true
            })
            console.log('Search results:', searchResults.length)
            console.log('Search scores:', searchResults.map(r => r.similarity))
        } catch (error) {
            console.error('Search similar documents error:', error)
        }

        // Test 5: Check database chunks
        console.log('\n--- Test 5: Database Chunks ---')
        try {
            const { prisma } = await import('@/lib/prisma')
            const chunks = await prisma.documentChunk.findMany({
                where: {
                    document: {
                        userId,
                        isDeleted: false
                    }
                },
                include: {
                    document: {
                        select: {
                            id: true,
                            title: true,
                            userId: true
                        }
                    }
                },
                take: 5
            })
            console.log('Database chunks found:', chunks.length)
            console.log('Chunk details:', chunks.map(c => ({
                id: c.id,
                documentId: c.documentId,
                documentTitle: c.document.title,
                documentUserId: c.document.userId,
                hasEmbedding: !!c.embedding,
                embeddingLength: c.embedding ? (c.embedding as number[]).length : 0
            })))
        } catch (error) {
            console.error('Database chunks error:', error)
        }

        return NextResponse.json({
            success: true,
            message: "Full debug test completed - check server logs for details"
        })
    } catch (error) {
        console.error('Full debug test error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Full debug test failed', 
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
