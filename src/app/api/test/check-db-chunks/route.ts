import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        // Get all document chunks
        const chunks = await prisma.documentChunk.findMany({
            take: 10,
            include: {
                document: {
                    select: {
                        id: true,
                        title: true,
                        isVectorized: true
                    }
                }
            }
        })

        // Get document stats
        const documentStats = await prisma.document.findMany({
            select: {
                id: true,
                title: true,
                isVectorized: true,
                userId: true
            },
            take: 5
        })

        return NextResponse.json({
            success: true,
            message: "Database chunks check",
            chunkCount: chunks.length,
            chunks: chunks.map(chunk => ({
                id: chunk.id,
                documentId: chunk.documentId,
                contentLength: chunk.content.length,
                hasEmbedding: !!chunk.embedding,
                embeddingLength: Array.isArray(chunk.embedding) ? chunk.embedding.length : 0,
                chunkIndex: chunk.chunkIndex,
                documentTitle: chunk.document.title,
                documentVectorized: chunk.document.isVectorized
            })),
            documents: documentStats
        })
    } catch (error) {
        console.error('Database check error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Database check failed', 
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
