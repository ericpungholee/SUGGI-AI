import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { searchSimilarDocuments } from "@/lib/ai"

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
        const query = searchParams.get('q')
        const limit = parseInt(searchParams.get('limit') || '10')
        const threshold = parseFloat(searchParams.get('threshold') || '0.7')

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                { error: "Search query is required" },
                { status: 400 }
            )
        }

        const results = await searchSimilarDocuments(query.trim(), session.user.id, {
            limit,
            threshold,
            includeContent: true
        })

        return NextResponse.json({ results })
    } catch (error) {
        console.error('AI search API error:', error)
        return NextResponse.json(
            { error: 'Failed to search documents' },
            { status: 500 }
        )
    }
}
