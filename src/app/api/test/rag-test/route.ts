import { NextRequest, NextResponse } from 'next/server'
import { getDocumentContext } from '@/lib/ai/vector-search'

export async function POST(request: NextRequest) {
  try {
    const { query, documentId, userId } = await request.json()

    if (!query || !documentId || !userId) {
      return NextResponse.json({ 
        error: 'Query, documentId, and userId are required' 
      }, { status: 400 })
    }

    console.log(`Testing RAG with query: "${query}"`)

    // Test context retrieval
    const context = await getDocumentContext(query, userId, documentId, 5)

    return NextResponse.json({
      success: true,
      query,
      documentId,
      userId,
      context: {
        retrieved: context.length > 0,
        length: context.length,
        preview: context.substring(0, 500) + (context.length > 500 ? '...' : ''),
        fullContext: context
      },
      analysis: {
        hasNeuroCore: context.includes('NeuroCore X1'),
        hasRTXOrion: context.includes('RTX Orion 5090'),
        hasQuantumVision: context.includes('Quantum Vision Engine'),
        hasAquaTalk: context.includes('AquaTalk 3000'),
        hasCitiTarget: context.includes('Citi lowered its Nvidia price target to $200')
      }
    })
  } catch (error) {
    console.error('Error in RAG test:', error)
    return NextResponse.json(
      { 
        error: 'RAG test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
