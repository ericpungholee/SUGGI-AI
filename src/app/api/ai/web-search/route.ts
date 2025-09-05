import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { searchWeb, validateSearchQuery } from "@/lib/ai"

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
        const type = searchParams.get('type') || 'web'

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                { error: "Search query is required" },
                { status: 400 }
            )
        }

        // Validate search query
        const validation = validateSearchQuery(query.trim())
        if (!validation.isValid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            )
        }

        let results
        switch (type) {
            case 'news':
                const { searchNews } = await import("@/lib/ai")
                results = await searchNews(query.trim(), { limit })
                break
            case 'academic':
                const { searchAcademic } = await import("@/lib/ai")
                results = await searchAcademic(query.trim(), { limit })
                break
            default:
                results = await searchWeb(query.trim(), { limit })
        }

        return NextResponse.json({ results })
    } catch (error) {
        console.error('Web search API error:', error)
        return NextResponse.json(
            { error: 'Failed to search web' },
            { status: 500 }
        )
    }
}
