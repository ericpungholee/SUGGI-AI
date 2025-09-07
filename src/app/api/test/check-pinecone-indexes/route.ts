import { NextResponse } from "next/server"
import { Pinecone } from '@pinecone-database/pinecone'

export async function GET() {
    try {
        const apiKey = process.env.PINECONE_API_KEY
        
        if (!apiKey) {
            return NextResponse.json({ error: "PINECONE_API_KEY not configured" })
        }

        const pinecone = new Pinecone({ apiKey })
        const indexList = await pinecone.listIndexes()
        
        console.log('Available Pinecone indexes:', indexList.indexes?.map(idx => ({
            name: idx.name,
            dimension: idx.dimension,
            metric: idx.metric,
            status: idx.status?.ready ? 'ready' : 'not ready'
        })))

        return NextResponse.json({
            success: true,
            indexes: indexList.indexes?.map(idx => ({
                name: idx.name,
                dimension: idx.dimension,
                metric: idx.metric,
                status: idx.status?.ready ? 'ready' : 'not ready'
            })) || []
        })
    } catch (error) {
        console.error('Error checking Pinecone indexes:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Failed to check Pinecone indexes',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
