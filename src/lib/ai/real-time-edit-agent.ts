// Client-side interface for real-time edit agent
// This calls the server-side API instead of using LangGraph directly

import { RealTimeEditAgentState, AgentTextBlock, AgentTypingSession, AgentTypingConfig } from '@/types'

// Default typing configuration
const defaultTypingConfig: AgentTypingConfig = {
  typingSpeed: 50, // 50ms per character
  pauseBetweenWords: 100, // 100ms pause between words
  pauseBetweenSentences: 300, // 300ms pause between sentences
  maxBlockSize: 200 // Max 200 characters per block
}

// Main function to process real-time edit requests (client-side)
export async function processRealTimeEditRequest(
  userMessage: string,
  documentId: string,
  documentContent: string,
  conversationHistory: Array<{role: string, content: string}> = []
): Promise<RealTimeEditAgentState> {
  try {
    console.log('🤖 Client: Sending real-time edit request to API:', {
      userMessage: userMessage.substring(0, 100),
      documentId,
      contentLength: documentContent.length
    })

    const response = await fetch('/api/ai/real-time-edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userMessage,
        documentId,
        documentContent,
        conversationHistory
      })
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown API error')
    }

    console.log('✅ Client: Received real-time edit response:', {
      hasSession: !!result.result.agentTypingSession,
      hasBlocks: result.result.typingBlocks?.length || 0,
      processingStep: result.result.processingStep
    })

    return result.result

  } catch (error) {
    console.error('❌ Client: Error in processRealTimeEditRequest:', error)
    return {
      userMessage,
      documentId,
      documentContent,
      conversationHistory,
      agentTypingSession: null,
      currentTypingBlock: null,
      editRequest: null,
      detectedIntent: '',
      confidence: 0,
      editPlan: null,
      generatedContent: '',
      typingBlocks: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      processingStep: 'error',
      timestamp: new Date()
    }
  }
}

// Utility function to create typing blocks from content (client-side)
export function createTypingBlocks(
  content: string, 
  config: AgentTypingConfig = defaultTypingConfig
): AgentTextBlock[] {
  const sentences = content.split(/(?<=[.!?])\s+/)
  const blocks: AgentTextBlock[] = []
  
  let currentBlock = ''
  let blockIndex = 0
  
  for (const sentence of sentences) {
    if (currentBlock.length + sentence.length > config.maxBlockSize && currentBlock.length > 0) {
      // Create a block with current content
      blocks.push({
        id: `auto_block_${Date.now()}_${blockIndex}`,
        content: currentBlock.trim(),
        startPosition: 0, // Will be set by UI
        endPosition: 0, // Will be set by UI
        isAgentText: true,
        isApproved: false,
        createdAt: new Date(),
        metadata: {
          intent: 'auto_generated',
          confidence: 0.9,
          source: 'agent'
        }
      })
      
      currentBlock = sentence
      blockIndex++
    } else {
      currentBlock += (currentBlock.length > 0 ? ' ' : '') + sentence
    }
  }
  
  // Add the last block
  if (currentBlock.trim().length > 0) {
    blocks.push({
      id: `auto_block_${Date.now()}_${blockIndex}`,
      content: currentBlock.trim(),
      startPosition: 0,
      endPosition: 0,
      isAgentText: true,
      isApproved: false,
      createdAt: new Date(),
      metadata: {
        intent: 'auto_generated',
        confidence: 0.9,
        source: 'agent'
      }
    })
  }
  
  return blocks
}