// Server-side real-time edit agent (simplified without LangGraph complexity)
// This file should only be imported in API routes

import { RealTimeEditAgentState, AgentTextBlock, AgentTypingSession, AgentTypingConfig } from '@/types'
import { parseTableRequest, generateTableHTML } from './table-utils'
import { processTableEditRequest } from './table-editing-utils'

// Default typing configuration
const defaultTypingConfig: AgentTypingConfig = {
  typingSpeed: 50, // 50ms per character
  pauseBetweenWords: 100, // 100ms pause between words
  pauseBetweenSentences: 300, // 300ms pause between sentences
  maxBlockSize: 200 // Max 200 characters per block
}

// Simple edit request detection
function detectEditRequest(userMessage: string): { isEdit: boolean; intent: string; confidence: number } {
  const lowerMessage = userMessage.toLowerCase()
  
  // Edit keywords
  const editKeywords = [
    'write', 'edit', 'improve', 'fix', 'change', 'create', 'add', 'generate', 
    'essay', 'about', 'summarize', 'expand', 'rewrite', 'revise', 'update',
    'correct', 'enhance', 'modify', 'refactor', 'restructure'
  ]
  
  const hasEditKeywords = editKeywords.some(keyword => lowerMessage.includes(keyword))
  
  if (hasEditKeywords) {
    return {
      isEdit: true,
      intent: userMessage,
      confidence: 0.8
    }
  }
  
  return {
    isEdit: false,
    intent: 'not_edit',
    confidence: 0.9
  }
}

// Create typing blocks from content
function createTypingBlocks(content: string, sessionId: string): AgentTextBlock[] {
  // Split content into sentences for natural typing
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
  
  if (sentences.length === 0) {
    return []
  }
  
  const blocks: AgentTextBlock[] = []
  
  sentences.forEach((sentence, index) => {
    blocks.push({
      id: `block_${sessionId}_${index}`,
      content: sentence.trim(),
      startPosition: 0, // Will be set by UI
      endPosition: 0, // Will be set by UI
      isAgentText: true,
      isApproved: false,
      createdAt: new Date(),
      metadata: {
        intent: 'auto_generated',
        confidence: 0.8,
        source: 'agent'
      }
    })
  })
  
  return blocks
}

// Main function to process real-time edit requests (simplified)
export async function processRealTimeEditRequest(
  userMessage: string,
  documentId: string,
  documentContent: string,
  conversationHistory: Array<{role: string, content: string}> = []
): Promise<RealTimeEditAgentState> {
  
  console.log('🚀 Server: Processing real-time edit request:', {
    userMessage: userMessage.substring(0, 100),
    documentId,
    contentLength: documentContent.length
  })
  
  try {
    // Detect if this is an edit request
    const detection = detectEditRequest(userMessage)
    
    console.log('🔍 Detection result:', detection)
    
    if (!detection.isEdit) {
      console.log('📝 Not an edit request - returning not_edit state')
      return {
        userMessage,
        documentId,
        documentContent,
        conversationHistory,
        agentTypingSession: null,
        currentTypingBlock: null,
        editRequest: null,
        detectedIntent: 'not_edit',
        confidence: detection.confidence,
        editPlan: null,
        generatedContent: '',
        typingBlocks: [],
        error: null,
        processingStep: 'not_edit',
        timestamp: new Date()
      }
    }
    
    // Create typing session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const typingSession: AgentTypingSession = {
      id: sessionId,
      documentId: documentId,
      isActive: true,
      blocks: [],
      startedAt: new Date(),
      userIntent: userMessage
    }
    
    // Generate content using AI instead of hardcoded templates
    let generatedContent = ''
    
    // Check if this is a table editing request for existing tables
    console.log('🔍 Checking for table edit request:', { userMessage, contentLength: documentContent.length })
    console.log('📄 Document content preview:', documentContent.substring(0, 200))
    const tableEditResult = processTableEditRequest(userMessage, documentContent)
    console.log('📊 Table edit result:', { isTableEdit: tableEditResult.isTableEdit, hasEditedContent: !!tableEditResult.editedContent })
    
    if (tableEditResult.isTableEdit) {
      // For table editing, we need to replace the entire document content
      // This will be handled by the frontend to replace the specific table
      generatedContent = tableEditResult.editedContent
      console.log('✅ Using table edit result as generated content')
    } else {
      // Check if this is a new table request
      const tableSpec = parseTableRequest(userMessage)
      if (tableSpec) {
        generatedContent = generateTableHTML(tableSpec)
      } else {
      try {
        // Import the generateChatCompletion function
        const { generateChatCompletion } = await import('@/lib/ai/openai')
      
      // Build a system prompt that focuses on natural content generation
      const systemPrompt = `You are an AI writing assistant. Generate ONLY the substantive content requested by the user.

User request: "${userMessage}"

Document context:
Title: ${documentContent.split('\n')[0] || 'Untitled Document'}
Existing content: ${documentContent.substring(0, 2000)}${documentContent.length > 2000 ? '...' : ''}

CRITICAL RULES:
1. Generate ONLY the actual content requested - no meta-commentary, explanations, or reports
2. Do NOT include phrases like "Here's the content", "I've generated", "This document", etc.
3. Do NOT reference the document title or existing content in a meta way
4. Do NOT include any user-facing messages or status updates
5. Write as if you are the author of the document, not an AI assistant
6. Generate substantive, well-structured content about the requested topic
7. If asked to delete/clear content, generate EMPTY content (nothing)
8. If asked to write about a topic, write directly about that topic
9. Do NOT include options, suggestions, or prompts for the user
10. Do NOT include phrases like "What would you like", "Here are options", "Please share"

TABLE GENERATION RULES:
- When creating tables, use proper HTML markup: <table class="editor-table" data-table="true"><tbody><tr><td contenteditable="true" data-table-cell="true">content</td></tr></tbody></table>
- For table headers, use <th> elements instead of <td> in the first row
- Always include the required attributes: class="editor-table", data-table="true", data-table-cell="true"
- Generate meaningful content for table cells based on the user's request
- For table dimensions, create the exact number of rows and columns requested
- Include relevant data or placeholder content that makes sense for the table's purpose

SPECIAL INSTRUCTIONS FOR DELETE/CLEAR REQUESTS:
- If the user asks to delete or clear content, generate EMPTY content
- Do NOT generate any text, options, or suggestions
- Do NOT include phrases like "Draft cleared" or "What would you like to write next"
- Just return empty content

Generate the content directly without any introductory phrases, meta-commentary, or explanations.`

      // Generate content using OpenAI
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ]

      const response = await generateChatCompletion(messages, {
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 2000
      })

      let rawContent = response.choices[0]?.message?.content || ''
      
      // Debug: Check if AI is generating pipe characters
      if (rawContent.includes('|')) {
        console.log('🚨 Real-time AI generated pipe characters:', {
          originalLength: rawContent.length,
          pipeCount: (rawContent.match(/\|/g) || []).length,
          preview: rawContent.substring(0, 200) + '...',
          fullContent: rawContent
        })
      }
      
      // Clean up any meta-commentary that might have slipped through
      generatedContent = rawContent
        .replace(/^(Here's|I've|This document|I'll|Let me|I'm going to|I can|I will).*?[.!?]\s*/gmi, '')
        .replace(/^(I apologize|Sorry|Unfortunately|I'm sorry).*?[.!?]\s*/gmi, '')
        .replace(/^(I've generated|I've created|I've written|I've added).*?[.!?]\s*/gmi, '')
        .replace(/^(The content|The document|This content).*?[.!?]\s*/gmi, '')
        .replace(/^(Draft cleared|Content cleared|Document cleared).*?[.!?]\s*/gmi, '')
        .replace(/^(What would you like|Here are|Please share|If you prefer).*?[.!?]\s*/gmi, '')
        .replace(/^(I can|I will|I'll help|I'm here).*?[.!?]\s*/gmi, '')
        .replace(/\|+/g, '') // Remove pipe characters that cause blue line artifacts
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
      
      // Special handling for delete/clear requests
      if (userMessage.toLowerCase().includes('delete') || userMessage.toLowerCase().includes('clear')) {
        generatedContent = '' // Return empty content for delete/clear requests
      }
      
      // If content is empty after cleaning, provide a fallback
      if (!generatedContent) {
        generatedContent = ''
      }
      
      } catch (error) {
        console.error('Error generating AI content:', error)
        // Fallback to a simple response if AI generation fails
        generatedContent = `I'll help you with that request. Let me generate some content for you.`
      }
    }
    
    // Create typing blocks
    const typingBlocks = createTypingBlocks(generatedContent, sessionId)
    
    console.log('✅ Server: Created typing session:', {
      sessionId,
      blocksCount: typingBlocks.length,
      contentLength: generatedContent.length
    })
    
    return {
      userMessage,
      documentId,
      documentContent,
      conversationHistory,
      agentTypingSession: typingSession,
      currentTypingBlock: typingBlocks[0] || null,
      editRequest: {
        documentId: documentId,
        scope: 'document',
        userIntent: userMessage,
        guardrails: {
          allowCodeEdits: true,
          allowMathEdits: true,
          preserveVoice: true
        }
      },
      detectedIntent: userMessage,
      confidence: detection.confidence,
      editPlan: {
        approach: 'real_time_typing',
        changes: [userMessage],
        guardrails: ['preserve_voice', 'maintain_context'],
        typingStrategy: 'immediate'
      },
      generatedContent,
      typingBlocks,
      error: null,
      processingStep: 'edit_planned',
      timestamp: new Date()
    }
    
  } catch (error) {
    console.error('❌ Server: Error in processRealTimeEditRequest:', error)
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
