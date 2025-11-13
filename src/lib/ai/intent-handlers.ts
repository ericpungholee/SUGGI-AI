/**
 * Intent Handlers
 * Implements routing behavior for each intent type
 */

import { WritingIntent } from './writing-intent-classifier'
import { createRAGOrchestrator } from './rag-orchestrator'
import { webSearch } from './services/web-search'
import { getChatModel } from './core/models'
import { generateChatCompletion } from './openai'
import { processWritingRequest } from './langgraph-writer-agent'
import { generatePatch, generateInlinePatch, htmlToPlainText } from './patch-utils'

export interface HandlerContext {
  message: string
  documentId?: string
  documentContent?: string
  selection?: string
  cursorPosition?: string
  conversationHistory?: any[]
  userId: string
  forceWebSearch?: boolean
}

export interface HandlerResult {
  content: string
  metadata: {
    intent: WritingIntent
    shouldTriggerLiveEdit?: boolean
    patch?: string // Unified diff patch
    oldContent?: string // Original content for patch generation
    newContent?: string // New content for patch generation
    sources?: any[]
    citations?: any[]
    [key: string]: any
  }
}

/**
 * Helper function to handle content generation errors
 */
function handleContentGenerationError(
  newContent: string,
  result: any,
  intent: WritingIntent
): HandlerResult | null {
  // If still no content and there's an error, return error message
  if (!newContent && result.error) {
    return {
      content: `I encountered an error: ${result.error}. Please try again.`,
      metadata: {
        intent,
        shouldTriggerLiveEdit: false,
        error: result.error
      }
    }
  }
  
  // If no content at all, return helpful message
  if (!newContent) {
    return {
      content: 'I wasn\'t able to generate content. Please try rephrasing your request or provide more context.',
      metadata: {
        intent,
        shouldTriggerLiveEdit: false
      }
    }
  }
  
  return null
}

/**
 * Route handler for GENERAL_CHAT intent
 */
export async function handleGeneralChat(context: HandlerContext): Promise<HandlerResult> {
  const { message, conversationHistory = [] } = context
  
  const messages = [
    {
      role: 'system' as const,
      content: `You are an AI writing assistant. Respond conversationally to the user's question.`
    },
    ...conversationHistory,
    {
      role: 'user' as const,
      content: message
    }
  ]

  const response = await generateChatCompletion(messages, {
    model: getChatModel(),
    temperature: 0.7,
    max_tokens: 2000
  })

  return {
    content: response.choices[0]?.message?.content?.trim() || '',
    metadata: {
      intent: 'GENERAL_CHAT',
      shouldTriggerLiveEdit: false
    }
  }
}

/**
 * Route handler for DOC_QA_RAG intent
 */
export async function handleDocQARAG(context: HandlerContext): Promise<HandlerResult> {
  const { message, documentId, userId, conversationHistory = [] } = context
  
  // Perform embedding search across internal docs
  const orchestrator = createRAGOrchestrator({
    userId,
    documentId,
    maxTokens: 2000,
    enableWebSearch: false, // RAG only, no web search
    conversationHistory
  })

  const ragResponse = await orchestrator.processQuery(message)
  
  return {
    content: ragResponse.content,
    metadata: {
      intent: 'DOC_QA_RAG',
      shouldTriggerLiveEdit: false,
      sources: ragResponse.citations || [],
      sourcesUsed: ragResponse.metadata?.sourcesUsed || 0,
      ragConfidence: ragResponse.metadata?.ragConfidence,
      coverage: ragResponse.metadata?.coverage
    }
  }
}

/**
 * Route handler for WRITE_INLINE intent
 */
export async function handleWriteInline(context: HandlerContext): Promise<HandlerResult> {
  const { message, documentContent, selection, documentId, userId } = context
  
  // Check if this is a delete/clear command
  const messageLower = message.toLowerCase()
  const isDeleteCommand = messageLower.includes('delete all') || 
                         messageLower.includes('clear all') || 
                         messageLower.includes('remove all') ||
                         messageLower.includes('empty') ||
                         messageLower.includes('wipe') ||
                         messageLower.includes('delete everything') ||
                         messageLower.includes('clear everything') ||
                         messageLower.includes('remove everything') ||
                         messageLower.includes('delete content') ||
                         messageLower.includes('clear content')
  
  if (isDeleteCommand && documentId) {
    // Return empty string to clear the document
    return {
      content: '', // Empty string triggers document clear
      metadata: {
        intent: 'WRITE_INLINE',
        shouldTriggerLiveEdit: true,
        isDeleteAll: true,
        directPaste: true
      }
    }
  }
  
  // Transform only the provided/selected text
  const targetText = selection || documentContent || ''
  
  if (!targetText) {
    return {
      content: 'Please select text or provide content to edit.',
      metadata: {
        intent: 'WRITE_INLINE',
        shouldTriggerLiveEdit: false
      }
    }
  }

  // Store original content for patch generation
  const oldContent = targetText
  const oldPlainText = htmlToPlainText(oldContent)

  // Use LangGraph writer agent for inline edits
  const result = await processWritingRequest(
    message,
    targetText,
    documentId || '',
    userId,
    {
      webSearchText: '',
      webSearchCitations: [],
      forceWebSearch: false
    }
  )

  // Extract content from operations
  let newContent = ''
  if (result.previewOps && result.previewOps.length > 0) {
    const textOps = result.previewOps.filter(op => op.text || op.content)
    newContent = textOps.map(op => op.text || op.content || '').join('')
  }
  
  // Fallback to approval message if no content from operations
  if (!newContent && result.approvalMessage) {
    // If only approval message, return it as content (no patch)
    return {
      content: result.approvalMessage,
      metadata: {
        intent: 'WRITE_INLINE',
        shouldTriggerLiveEdit: false
      }
    }
  }
  
  // Handle content generation errors
  const errorResult = handleContentGenerationError(newContent, result, 'WRITE_INLINE')
  if (errorResult) return errorResult

  // Generate patch for the change
  const newPlainText = htmlToPlainText(newContent)
  const patch = generateInlinePatch(oldPlainText, newPlainText, documentId || 'document.md')

  return {
    content: `I've prepared an edit. Review the patch below and approve or deny the change.\n\n${patch}`,
    metadata: {
      intent: 'WRITE_INLINE',
      shouldTriggerLiveEdit: true,
      patch,
      oldContent: oldPlainText,
      newContent: newPlainText,
      langGraphWriterAgent: {
        task: result.task,
        confidence: result.confidence,
        previewOps: result.previewOps
      }
    }
  }
}

/**
 * Route handler for WRITE_LONGFORM intent
 */
export async function handleWriteLongform(context: HandlerContext): Promise<HandlerResult> {
  const { message, documentContent, documentId, userId, forceWebSearch = false } = context
  
  let webSearchText = ''
  let webSearchCitations: any[] = []
  
  // Use Web Search ONLY if explicitly requested
  if (forceWebSearch) {
    try {
      const webData = await webSearch({
        prompt: `Search for current information about: ${message}`,
        model: getChatModel(),
        maxResults: 8,
        includeImages: false,
        searchRegion: 'US',
        language: 'en',
        timeoutMs: 60000
      })
      
      webSearchText = webData.text || ''
      webSearchCitations = webData.citations || []
    } catch (error) {
      console.error('Web search failed:', error)
    }
  }

  // Store original content for patch generation
  const oldContent = documentContent || ''
  const oldPlainText = htmlToPlainText(oldContent)

  // Use LangGraph writer agent for long-form writing
  const result = await processWritingRequest(
    message,
    documentContent || '',
    documentId || '',
    userId,
    {
      webSearchText,
      webSearchCitations,
      forceWebSearch
    }
  )

  // Extract content from operations
  let newContent = ''
  if (result.previewOps && result.previewOps.length > 0) {
    const textOps = result.previewOps.filter(op => op.text || op.content)
    newContent = textOps.map(op => op.text || op.content || '').join('')
  }
  
  // Fallback to approval message if no content from operations
  if (!newContent && result.approvalMessage) {
    // If only approval message, return it as content (no patch)
    return {
      content: result.approvalMessage,
      metadata: {
        intent: 'WRITE_LONGFORM',
        shouldTriggerLiveEdit: false
      }
    }
  }
  
  // Handle content generation errors
  const errorResult = handleContentGenerationError(newContent, result, 'WRITE_LONGFORM')
  if (errorResult) return errorResult

  // Generate patch for the change
  const newPlainText = htmlToPlainText(newContent)
  const patch = generatePatch(oldPlainText, newPlainText, documentId || 'document.md')

  return {
    content: `I've prepared the writing. Review the patch below and approve or deny the change.\n\n${patch}`,
    metadata: {
      intent: 'WRITE_LONGFORM',
      shouldTriggerLiveEdit: true,
      patch,
      oldContent: oldPlainText,
      newContent: newPlainText,
      sources: result.sources || [],
      citations: webSearchCitations,
      langGraphWriterAgent: {
        task: result.task,
        confidence: result.confidence,
        previewOps: result.previewOps,
        sources: result.sources
      }
    }
  }
}

/**
 * Route handler for FILE_OP intent
 */
export async function handleFileOp(context: HandlerContext): Promise<HandlerResult> {
  const { message } = context
  
  // For now, return a message about file operations
  // In the future, this could integrate with file system operations
  return {
    content: 'File operations are not yet fully implemented. Please use the document interface to manage files.',
    metadata: {
      intent: 'FILE_OP',
      shouldTriggerLiveEdit: false
    }
  }
}

/**
 * Route handler for WEB_SEARCH intent
 */
export async function handleWebSearch(context: HandlerContext): Promise<HandlerResult> {
  const { message } = context
  
  try {
    const webData = await webSearch({
      prompt: `Search for current information about: ${message}`,
      model: getChatModel(),
      maxResults: 8,
      includeImages: false,
      searchRegion: 'US',
      language: 'en',
      timeoutMs: 60000
    })

    const webSearchText = webData.text || ''
    const webSearchCitations = webData.citations || []
    
    // Format response with citations
    let content = webSearchText
    if (webSearchCitations.length > 0) {
      const citationsText = webSearchCitations.map((citation, index) => 
        `${index + 1}. ${citation.title || citation.domain || 'Source'}: ${citation.url}`
      ).join('\n')
      content += `\n\nSources:\n${citationsText}`
    }

    return {
      content,
      metadata: {
        intent: 'WEB_SEARCH',
        shouldTriggerLiveEdit: false,
        citations: webSearchCitations,
        sources: webSearchCitations.length
      }
    }
  } catch (error) {
    console.error('Web search error:', error)
    return {
      content: 'I encountered an error while searching the web. Please try again.',
      metadata: {
        intent: 'WEB_SEARCH',
        shouldTriggerLiveEdit: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * Route handler for AGENT_TASK intent
 * This is the ONLY intent allowed to mix RAG + Web Search + writing + planning
 */
export async function handleAgentTask(context: HandlerContext): Promise<HandlerResult> {
  const { message, documentContent, documentId, userId, conversationHistory = [] } = context
  
  // Step 1: Perform RAG search if relevant
  let ragContent = ''
  let ragSources: any[] = []
  
  if (documentId) {
    try {
      const orchestrator = createRAGOrchestrator({
        userId,
        documentId,
        maxTokens: 2000,
        enableWebSearch: false, // We'll do web search separately
        conversationHistory
      })
      
      const ragResponse = await orchestrator.processQuery(message)
      ragContent = ragResponse.content
      ragSources = ragResponse.metadata?.sourcesUsed || []
    } catch (error) {
      console.error('RAG search error:', error)
    }
  }

  // Step 2: Perform Web Search
  let webSearchText = ''
  let webSearchCitations: any[] = []
  
  try {
    const webData = await webSearch({
      prompt: `Search for current information about: ${message}`,
      model: getChatModel(),
      maxResults: 8,
      includeImages: false,
      searchRegion: 'US',
      language: 'en',
      timeoutMs: 60000
    })
    
    webSearchText = webData.text || ''
    webSearchCitations = webData.citations || []
  } catch (error) {
    console.error('Web search error:', error)
  }

  // Step 3: Combine RAG and Web Search content
  const combinedContext = [
    ragContent ? `Internal Documents:\n${ragContent}` : '',
    webSearchText ? `Web Search Results:\n${webSearchText}` : ''
  ].filter(Boolean).join('\n\n')

  // Store original content for patch generation
  const oldContent = documentContent || ''
  const oldPlainText = htmlToPlainText(oldContent)

  // Step 4: Use LangGraph writer agent to synthesize and write
  const result = await processWritingRequest(
    message,
    documentContent || '',
    documentId || '',
    userId,
    {
      webSearchText: combinedContext || webSearchText,
      webSearchCitations: [...webSearchCitations, ...ragSources],
      forceWebSearch: true
    }
  )

  // Extract content from operations
  let newContent = ''
  if (result.previewOps && result.previewOps.length > 0) {
    const textOps = result.previewOps.filter(op => op.text || op.content)
    newContent = textOps.map(op => op.text || op.content || '').join('')
  }
  
  // Fallback to approval message if no content from operations
  if (!newContent && result.approvalMessage) {
    // If only approval message, return it as content (no patch)
    return {
      content: result.approvalMessage,
      metadata: {
        intent: 'AGENT_TASK',
        shouldTriggerLiveEdit: false
      }
    }
  }
  
  // Handle content generation errors
  const errorResult = handleContentGenerationError(newContent, result, 'AGENT_TASK')
  if (errorResult) return errorResult

  // Generate patch for the change
  const newPlainText = htmlToPlainText(newContent)
  const patch = generatePatch(oldPlainText, newPlainText, documentId || 'document.md')

  // Combine all sources
  const allSources = [...ragSources, ...webSearchCitations]

  return {
    content: `I've completed the multi-step task. Review the patch below and approve or deny the change.\n\n${patch}`,
    metadata: {
      intent: 'AGENT_TASK',
      shouldTriggerLiveEdit: true,
      patch,
      oldContent: oldPlainText,
      newContent: newPlainText,
      sources: allSources,
      citations: webSearchCitations,
      ragSources,
      langGraphWriterAgent: {
        task: result.task,
        confidence: result.confidence,
        previewOps: result.previewOps,
        sources: result.sources
      }
    }
  }
}

/**
 * Main router function that dispatches to the appropriate handler
 */
export async function routeByIntent(
  intent: WritingIntent,
  context: HandlerContext
): Promise<HandlerResult> {
  switch (intent) {
    case 'GENERAL_CHAT':
      return handleGeneralChat(context)
    
    case 'DOC_QA_RAG':
      return handleDocQARAG(context)
    
    case 'WRITE_INLINE':
      return handleWriteInline(context)
    
    case 'WRITE_LONGFORM':
      return handleWriteLongform(context)
    
    case 'FILE_OP':
      return handleFileOp(context)
    
    case 'WEB_SEARCH':
      return handleWebSearch(context)
    
    case 'AGENT_TASK':
      return handleAgentTask(context)
    
    default:
      // Fallback to general chat
      return handleGeneralChat(context)
  }
}

