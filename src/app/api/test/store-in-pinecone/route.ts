import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { storeDocumentInVectorDB } from "@/lib/ai/vector-db"

export async function POST(request: Request) {
    try {
        const { documentId } = await request.json()

        if (!documentId) {
            return NextResponse.json(
                { error: "Document ID is required" },
                { status: 400 }
            )
        }

        // Get document
        const document = await prisma.document.findFirst({
            where: {
                id: documentId,
                isDeleted: false
            },
            select: {
                id: true,
                title: true,
                plainText: true,
                content: true,
                userId: true
            }
        })

        if (!document) {
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

        // Extract content
        let content = document.plainText || ''
        if (!content && document.content) {
            if (typeof document.content === 'object' && document.content !== null && 'plainText' in document.content) {
                content = (document.content as any).plainText
            } else if (typeof document.content === 'string') {
                content = document.content
            }
        }

        if (!content) {
            return NextResponse.json(
                { error: "No content to store" },
                { status: 400 }
            )
        }

        // Store in Pinecone
        await storeDocumentInVectorDB(document.id, document.title, content, document.userId)

        return NextResponse.json({
            success: true,
            message: "Document stored in Pinecone successfully",
            document: {
                id: document.id,
                title: document.title,
                contentLength: content.length
            }
        })
    } catch (error) {
        console.error('Store in Pinecone error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Failed to store in Pinecone', 
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
