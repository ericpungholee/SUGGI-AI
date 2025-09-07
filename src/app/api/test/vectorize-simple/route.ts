import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { vectorizeDocument } from "@/lib/ai"

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
                userId: true
            }
        })

        if (!document) {
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

        if (!document.plainText) {
            return NextResponse.json(
                { error: "Document has no content to vectorize" },
                { status: 400 }
            )
        }

        // Vectorize the document
        await vectorizeDocument(document.id, document.plainText, document.userId)

        return NextResponse.json({
            success: true,
            message: "Document vectorized successfully",
            documentId: document.id,
            title: document.title
        })
    } catch (error) {
        console.error('Simple vectorization error:', error)
        return NextResponse.json(
            { error: 'Failed to vectorize document', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
