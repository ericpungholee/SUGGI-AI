import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createWriterAgentV2, RouterOut, Instruction, PreviewOps } from '@/lib/ai/writer-agent-v2'
import { generateChatCompletion } from '@/lib/ai/openai'
import { createRAGOrchestrator } from '@/lib/ai/rag-orchestrator'
import { createCursorRAGOrchestrator } from '@/lib/ai/cursor-rag-orchestrator'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    const { 
      userAsk, 
      selectionText = '', 
      filePath = '', 
      recentTopics = [],
      documentId,
      action = 'process', // 'process', 'apply', 'revert'
      useWebSearch = false, // New parameter for explicit web search
      conversationHistory = [], // Conversation history for context
      linkedDocuments = [] // Linked documents for RAG (up to 5)
    } = body

    if (!userAsk && action === 'process') {
      return NextResponse.json(
        { error: 'User ask is required for processing' },
        { status: 400 }
      )
    }

    // Health check endpoint
    if (action === 'health') {
      return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        userId: session.user.id,
        documentId
      })
    }

    if (action === 'process') {
      try {
        // Create Writer Agent V2 instance
        const writerAgent = createWriterAgentV2(session.user.id, documentId)
        
        // Route the request
        const routerOut = await writerAgent.route(userAsk, selectionText, filePath, recentTopics)
        
        // Retrieve context using Cursor RAG Orchestrator
        const { ragChunks, webResults, documentOutline } = await retrieveContextWithCursorRAG(
          routerOut, 
          session.user.id, 
          documentId, 
          useWebSearch,
          conversationHistory,
          linkedDocuments
        )
        
        // Plan the instruction
        const instruction = await writerAgent.plan(
          routerOut, 
          userAsk, 
          selectionText, 
          documentOutline, 
          ragChunks, 
          webResults
        )
        
        // Execute and generate content directly
        const previewOps = await writerAgent.execute(instruction)
        
        // Extract the content to write from the preview ops
        const contentToWrite = previewOps.ops
          .filter(op => op.op === 'insert' && op.text)
          .map(op => op.text)
          .join('\n')
        
        // Generate approval message for saving
        const approvalMessage = writerAgent.generateApprovalMessage(previewOps)
        
        return NextResponse.json({
          type: 'immediate_write',
          data: {
            content: contentToWrite,
            previewOps: previewOps,
            pending_change_id: previewOps.pending_change_id
          },
          message: approvalMessage
        })
      } catch (error) {
        return NextResponse.json(
          { 
            error: 'Failed to process writer agent request',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }

    if (action === 'apply') {
      const { pending_change_id } = body
      return NextResponse.json({
        success: true,
        message: `Applied change ${pending_change_id}`
      })
    }

    if (action === 'revert') {
      const { pending_change_id } = body
      return NextResponse.json({
        success: true,
        message: `Reverted change ${pending_change_id}`
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to process writer agent request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper functions for Writer Agent processing

/**
 * Step 2: Retrieve context using Cursor RAG Orchestrator with 5-document limit
 */
async function retrieveContextWithCursorRAG(
  routerOut: RouterOut,
  userId: string,
  documentId?: string,
  useWebSearch: boolean = false,
  conversationHistory: any[] = [],
  linkedDocuments: string[] = []
): Promise<{
  ragChunks: any[]
  webResults: any[]
  documentOutline: string
}> {
  let ragChunks: any[] = []
  let webResults: any[] = []
  let documentOutline = ''

  // Use Cursor RAG Orchestrator if needed
  if (routerOut.needs.doc_context !== 'none' && documentId) {
    try {
      const orchestrator = createCursorRAGOrchestrator({
        userId,
        documentId,
        maxLinkedDocuments: 5,
        maxTokens: 2000,
        enableWebSearch: useWebSearch || routerOut.needs.web_context !== 'no',
        webSearchTimeout: 5000,
        conversationHistory,
        linkedDocuments
      })

      const ragResponse = await orchestrator.processQuery(routerOut.query.semantic)
      
      // Extract chunks from RAG response
      ragChunks = ragResponse.metadata.sourcesUsed > 0 ? [] : [] // Placeholder - would need actual implementation
      webResults = [] // Placeholder - would need actual implementation
      documentOutline = '' // Placeholder - would need actual implementation
    } catch (error) {
      // RAG retrieval failed, continue without context
      ragChunks = []
      webResults = []
      documentOutline = ''
    }
  }

  // Use web search if needed
  if ((useWebSearch || routerOut.needs.web_context === 'required') && routerOut.needs.web_context !== 'no') {
    try {
      const searchQuery = routerOut.query.semantic
      const webResponse = await performWebSearch(searchQuery)
      webResults = webResponse.results || []
    } catch (error) {
      // console.error('Web search error:', error)
    }
  }

  return { ragChunks, webResults, documentOutline }
}

/**
 * Legacy retrieve context function for backward compatibility
 */
async function retrieveContext(
  routerOut: RouterOut,
  userId: string,
  documentId?: string,
  useWebSearch: boolean = false,
  conversationHistory: any[] = []
): Promise<{
  ragChunks: any[]
  webResults: any[]
  documentOutline: string
}> {
  let ragChunks: any[] = []
  let webResults: any[] = []
  let documentOutline = ''

  // Use RAG if needed
  if (routerOut.needs.doc_context !== 'none' && documentId) {
    try {
      const orchestrator = createRAGOrchestrator({
        userId,
        documentId,
        maxTokens: 2000,
        enableWebSearch: useWebSearch || routerOut.needs.web_context !== 'no',
        webSearchTimeout: 5000,
        conversationHistory
      })

      const ragResponse = await orchestrator.processQuery(routerOut.query.semantic)
      // Extract chunks from RAG response (this would need to be adapted based on your RAG system)
      ragChunks = [] // Placeholder - would need actual implementation
      webResults = [] // Placeholder - would need actual implementation
    } catch (error) {
      // console.error('RAG retrieval error:', error)
    }
  }

  // Use web search if needed
  if ((useWebSearch || routerOut.needs.web_context === 'required') && routerOut.needs.web_context !== 'no') {
    try {
      const searchQuery = routerOut.query.semantic
      const webResponse = await performWebSearch(searchQuery)
      webResults = webResponse.results || []
    } catch (error) {
      // console.error('Web search error:', error)
    }
  }

  return { ragChunks, webResults, documentOutline }
}

/**
 * Perform web search using the web search API
 */
async function performWebSearch(query: string): Promise<{ results: any[] }> {
  try {
    // console.log('🔍 Writer Agent: Performing web search for:', query)
    
    // Use the web search API endpoint
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/web-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    })

    if (!response.ok) {
      throw new Error(`Web search API error: ${response.status}`)
    }

    const data = await response.json()
    // console.log('✅ Writer Agent: Web search completed, found', data.results?.length || 0, 'results')
    
    return { results: data.results || [] }
  } catch (error) {
    // console.error('Writer Agent: Web search error:', error)
    return { results: [] }
  }
}

