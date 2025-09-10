import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { searchSimilarDocuments, getDocumentStats } from "@/lib/ai"
import { vectorDB } from "@/lib/ai/vector-db"

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
        const action = searchParams.get('action') || 'stats'

        if (action === 'stats') {
            // Get document statistics
            const stats = await getDocumentStats(session.user.id)
            
            // Get vector database stats (if configured)
            let vectorStats = { totalChunks: 0, totalDocuments: 0 }
            const hasPineconeConfig = process.env.PINECONE_API_KEY
            
            if (hasPineconeConfig) {
                try {
                    vectorStats = await vectorDB.getDocumentStats(session.user.id)
                } catch (error) {
                    console.warn('Failed to get vector database stats:', error)
                }
            }
            
            // Get sample documents
            const documents = await prisma.document.findMany({
                where: {
                    userId: session.user.id,
                    isDeleted: false
                },
                select: {
                    id: true,
                    title: true,
                    isVectorized: true,
                    wordCount: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' },
                take: 5
            })

            // Get sample chunks
            const chunks = await prisma.documentChunk.findMany({
                where: {
                    document: {
                        userId: session.user.id,
                        isDeleted: false
                    }
                },
                select: {
                    id: true,
                    content: true,
                    chunkIndex: true,
                    document: {
                        select: {
                            id: true,
                            title: true
                        }
                    }
                },
                take: 3
            })

            return NextResponse.json({
                stats,
                vectorStats,
                documents,
                sampleChunks: chunks.map(chunk => ({
                    id: chunk.id,
                    content: chunk.content.substring(0, 100) + '...',
                    chunkIndex: chunk.chunkIndex,
                    documentTitle: chunk.document.title
                }))
            })
        }

        if (action === 'search') {
            const query = searchParams.get('q')
            if (!query) {
                return NextResponse.json(
                    { error: "Search query is required" },
                    { status: 400 }
                )
            }

            const results = await searchSimilarDocuments(query, session.user.id, {
                limit: 5,
                threshold: 0.5,
                includeContent: true
            })

            return NextResponse.json({ results })
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    } catch (error) {
        console.error('Vector test API error:', error)
        return NextResponse.json(
            { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
