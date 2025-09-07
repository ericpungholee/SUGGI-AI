import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createEmbedding, cosineSimilarity } from "@/lib/ai/embeddings"

export async function POST(request: Request) {
    try {
        const { userId, query } = await request.json()

        if (!userId || !query) {
            return NextResponse.json(
                { error: "userId and query are required" },
                { status: 400 }
            )
        }

        console.log('=== TESTING POSTGRESQL SEARCH ===')
        console.log('User ID:', userId)
        console.log('Query:', query)

        // Generate query embedding
        const queryEmbedding = await createEmbedding(query)
        console.log('Query embedding length:', queryEmbedding.embedding.length)

        // Get chunks from database
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
            }
        })

        console.log('Found chunks in database:', chunks.length)
        console.log('Chunk details:', chunks.map(c => ({
            id: c.id,
            documentId: c.documentId,
            documentTitle: c.document.title,
            hasEmbedding: !!c.embedding,
            embeddingLength: c.embedding ? (c.embedding as number[]).length : 0
        })))

        if (chunks.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No chunks found in database",
                chunkCount: 0
            })
        }

        // Calculate similarities
        const similarities = chunks.map(chunk => {
            const similarity = cosineSimilarity(queryEmbedding.embedding, chunk.embedding as number[])
            return {
                chunkId: chunk.id,
                documentId: chunk.documentId,
                documentTitle: chunk.document.title,
                similarity,
                content: chunk.content.substring(0, 100) + '...'
            }
        })

        // Sort by similarity
        const sortedSimilarities = similarities.sort((a, b) => b.similarity - a.similarity)
        const topResults = sortedSimilarities.slice(0, 3)

        console.log('Top similarities:', topResults.map(r => ({
            documentTitle: r.documentTitle,
            similarity: r.similarity,
            content: r.content
        })))

        return NextResponse.json({
            success: true,
            message: "PostgreSQL search test completed",
            chunkCount: chunks.length,
            topResults: topResults.map(r => ({
                documentTitle: r.documentTitle,
                similarity: r.similarity,
                content: r.content
            }))
        })
    } catch (error) {
        console.error('PostgreSQL search test error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'PostgreSQL search test failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
