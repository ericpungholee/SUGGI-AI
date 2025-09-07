import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { processDocument } from "@/lib/ai"

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { documentId } = await request.json()

        if (!documentId) {
            return NextResponse.json(
                { error: "Document ID is required" },
                { status: 400 }
            )
        }

        // Process document for AI features
        await processDocument(documentId, session.user.id, { forceReprocess: true })

        return NextResponse.json({
            success: true,
            message: "Document vectorized successfully",
            documentId
        })
    } catch (error) {
        console.error('Vectorization test error:', error)
        return NextResponse.json(
            { error: 'Failed to vectorize document', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
