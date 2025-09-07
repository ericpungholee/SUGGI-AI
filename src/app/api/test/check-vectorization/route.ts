import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
        const documentId = searchParams.get('documentId')

        if (!documentId) {
            return NextResponse.json(
                { error: "Document ID is required" },
                { status: 400 }
            )
        }

        // Check document vectorization status
        const document = await prisma.document.findFirst({
            where: {
                id: documentId,
                userId: session.user.id,
                isDeleted: false
            },
            select: {
                id: true,
                title: true,
                isVectorized: true,
                wordCount: true
            }
        })

        if (!document) {
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

        // Check chunks
        const chunks = await prisma.documentChunk.findMany({
            where: { documentId },
            select: {
                id: true,
                chunkIndex: true,
                content: true
            },
            orderBy: { chunkIndex: 'asc' }
        })

        return NextResponse.json({
            document: {
                id: document.id,
                title: document.title,
                isVectorized: document.isVectorized,
                wordCount: document.wordCount
            },
            chunks: chunks.map(chunk => ({
                id: chunk.id,
                chunkIndex: chunk.chunkIndex,
                content: chunk.content.substring(0, 100) + '...'
            })),
            chunkCount: chunks.length
        })
    } catch (error) {
        console.error('Check vectorization error:', error)
        return NextResponse.json(
            { error: 'Failed to check vectorization status', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
