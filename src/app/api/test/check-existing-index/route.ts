import { NextResponse } from "next/server"
import { vectorDB } from "@/lib/ai/vector-db"

export async function GET() {
    try {
        console.log('=== CHECKING EXISTING INDEX ===')
        
        // Initialize with the correct index name
        await vectorDB.initialize()
        
        // Get stats for all users (no filter)
        const allStats = await vectorDB.getDocumentStats('')
        console.log('All users stats:', allStats)
        
        // Get stats for specific user
        const userStats = await vectorDB.getDocumentStats('cmf7al4430000bj24i5yyx724')
        console.log('User stats:', userStats)
        
        // Try a search
        const searchResults = await vectorDB.searchDocuments('venture capital', 'cmf7al4430000bj24i5yyx724', {
            topK: 5,
            includeMetadata: true
        })
        console.log('Search results:', searchResults.length)
        console.log('Search scores:', searchResults.map(r => r.score))
        
        return NextResponse.json({
            success: true,
            allStats,
            userStats,
            searchResults: searchResults.length,
            searchScores: searchResults.map(r => r.score)
        })
    } catch (error) {
        console.error('Error checking existing index:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Failed to check existing index',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
