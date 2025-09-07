import { NextResponse } from "next/server"
import { vectorDB } from "@/lib/ai/vector-db"

export async function GET() {
    try {
        // Initialize vector DB
        await vectorDB.initialize()
        
        // Get stats without user filter to see all chunks
        const stats = await vectorDB.getDocumentStats('')
        
        return NextResponse.json({
            success: true,
            message: "Vector database check",
            stats: stats
        })
    } catch (error) {
        console.error('Vector check error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Vector check failed', 
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
