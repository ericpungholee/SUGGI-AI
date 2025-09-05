import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { processDocument } from "@/lib/ai"

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { id } = await params

        // Check if document exists and belongs to user
        const document = await prisma.document.findFirst({
            where: {
                id: id,
                userId: session.user.id,
                isDeleted: false
            },
            select: {
                id: true,
                title: true,
                isVectorized: true
            }
        })

        if (!document) {
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

        // Process document for AI features
        await processDocument(id, session.user.id, { forceReprocess: true })

        return NextResponse.json({
            success: true,
            message: "Document vectorized successfully",
            documentId: id,
            title: document.title
        })
    } catch (error) {
        console.error('Document vectorization error:', error)
        return NextResponse.json(
            { error: 'Failed to vectorize document' },
            { status: 500 }
        )
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { id } = await params

        const { getDocumentProcessingStatus } = await import("@/lib/ai")
        const status = await getDocumentProcessingStatus(id, session.user.id)

        return NextResponse.json(status)
    } catch (error) {
        console.error('Document processing status error:', error)
        return NextResponse.json(
            { error: 'Failed to get document processing status' },
            { status: 500 }
        )
    }
}
