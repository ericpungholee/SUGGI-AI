import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateChatCompletion } from '@/lib/ai/openai'
import { createRAGOrchestrator } from '@/lib/ai/rag-orchestrator'
import { routerService } from '@/lib/ai/router-service'
import { RouterContext } from '@/lib/ai/intent-schema'

// Helper function to extract content for live editing
function extractContentForLiveEdit(content: string): string {
  console.log('🔍 Extracting content for live edit:', {
    contentLength: content.length,
    contentPreview: content.substring(0, 200) + '...'
  })
  
  // Look for content after common phrases with better regex patterns
  const patterns = [
    /I'll write[:\s]*\n?(.+)/is,
    /I'm writing[:\s]*\n?(.+)/is,
    /Let me write[:\s]*\n?(.+)/is,
    /Here's the[:\s]*\n?(.+)/is,
    /Here is the[:\s]*\n?(.+)/is,
    /I'll create[:\s]*\n?(.+)/is,
    /I'm creating[:\s]*\n?(.+)/is,
    /I'll add[:\s]*\n?(.+)/is,
    /I'm adding[:\s]*\n?(.+)/is,
    /Let me add[:\s]*\n?(.+)/is,
    /I'll insert[:\s]*\n?(.+)/is,
    /I'm inserting[:\s]*\n?(.+)/is,
    /Writing[:\s]*\n?(.+)/is,
    /Creating[:\s]*\n?(.+)/is,
    /Adding[:\s]*\n?(.+)/is,
    /I'll provide[:\s]*\n?(.+)/is,
    /I'm providing[:\s]*\n?(.+)/is,
    /Let me provide[:\s]*\n?(.+)/is
  ]
  
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()
      console.log('🔍 Pattern match found:', {
        pattern: pattern.toString(),
        extractedLength: extracted.length,
        extractedPreview: extracted.substring(0, 100) + '...'
      })
      // Only return if we have substantial content (more than just a few words)
      if (extracted.length > 20) {
        console.log('✅ Returning extracted content from pattern')
        return extracted
      }
    }
  }
  
  // If no pattern matches, check if it's structured content (report/document)
  const isStructured = content.length > 500 && (
    content.includes('#') || 
    content.includes('##') || 
    content.includes('**') || 
    content.includes('1.') || 
    content.includes('- ') || 
    content.includes('|')
  )
  
  console.log('🔍 Structured content check:', {
    isStructured,
    contentLength: content.length,
    hasHeaders: content.includes('#'),
    hasSubheaders: content.includes('##'),
    hasBold: content.includes('**'),
    hasNumbered: content.includes('1.'),
    hasBullets: content.includes('- '),
    hasTables: content.includes('|')
  })
  
  if (isStructured) {
    // For structured content, return the entire content
    console.log('✅ Returning full content as structured content')
    return content
  }
  
  // If no pattern matches and content is substantial, return as-is
  if (content.length > 100) {
    console.log('✅ Returning full content as substantial content')
    return content
  }
  
  // Return empty string if content is too short or doesn't match patterns
  console.log('❌ No content extracted - too short or no patterns matched')
  return ''
}

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
      message, 
      documentId, 
      selection,
      maxTokens = 2000,
      conversationHistory = [],
      forceWebSearch = false
    } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    console.log('💬 Chat Request:', {
      userId: session.user.id,
      documentId,
      messageLength: message.length,
      conversationLength: conversationHistory.length
    })

    // Use hybrid router for intent classification
    const routerContext: RouterContext = {
      has_attached_docs: !!documentId,
      doc_ids: documentId ? [documentId] : [],
      is_selection_present: !!selection && selection.length > 0,
      selection_length: selection?.length || 0,
      recent_tools: [], // Could be enhanced with session tracking
      conversation_length: conversationHistory.length,
      user_id: session.user.id,
      document_id: documentId
    }

    const routerResult = await routerService.classifyIntent(message, routerContext)
    
    console.log('🔍 Router Classification:', {
      intent: routerResult.classification.intent,
      confidence: routerResult.classification.confidence,
      needs_recency: routerResult.classification.slots.needs_recency,
      edit_target: routerResult.classification.slots.edit_target,
      outputs: routerResult.classification.slots.outputs,
      processing_time: routerResult.processing_time,
      fallback_used: routerResult.fallback_used
    })

    // Determine routing based on intent
    const shouldTriggerRAG = routerResult.classification.intent === 'rag_query'
    
    // Use pure model detection for web search - let the router decide, but override if forceWebSearch is true
    const shouldUseWebSearch = forceWebSearch || 
                               routerResult.classification.intent === 'web_search' || 
                               (routerResult.classification.intent === 'ask' && routerResult.classification.slots.needs_recency)

    console.log('🔍 Web Search Decision:', {
      intent: routerResult.classification.intent,
      needsRecency: routerResult.classification.slots.needs_recency,
      forceWebSearch,
      shouldUseWebSearch,
      reason: forceWebSearch ? 'User forced web search' : 
              shouldUseWebSearch ? 'Router detected web search needed' : 'Router suggests general knowledge'
    })
    
    const isEditRequest = routerResult.classification.intent === 'edit_request'
    const isEditorWrite = routerResult.classification.intent === 'editor_write'

    // Build conversation context
    const messages = [
      {
        role: 'system',
        content: `You are an AI writing assistant with advanced document manipulation capabilities. You help users write, edit, and format documents.

Key behaviors:
- When asked to write reports, research, or content, ALWAYS start your response with phrases like "I'll write:", "I'm writing:", "Let me write:", "Here's the content:", "I'll create:", "I'm creating:", "I'll add:", "I'm adding:", "I'll insert:", "I'm inserting:", "Writing:", "Creating:", or "Adding:"
- Don't ask for confirmation - just start writing immediately
- Use current information when available through web search
- Be helpful and direct
- Format content properly with markdown when appropriate
- Remember conversation context and build upon previous messages
- If user says "go ahead" or similar, proceed with the previous request
- ALWAYS include the actual content to be written after your introductory phrase
- For editor_write intents, focus on creating comprehensive, well-structured content

CRITICAL: Use ONLY real, current data in your responses. Never use placeholder values like "XYZ", "ABC", or generic examples. Use actual stock symbols, real company names, and current financial data.

CONTEXT AWARENESS:
- Pay close attention to previous conversation messages to understand references
- When user says "this stock", "the company", "it", etc., refer back to the conversation history to identify what they're referring to
- If previous messages discussed specific companies (like Tesla/TSLA), use that context when answering follow-up questions
- Maintain continuity across the conversation

FORMATTING AND MANIPULATION COMMANDS:
You can understand natural language commands for:
- Text formatting: "make this bold", "italicize that", "underline the text", "change color to red", "make it bigger"
- Text manipulation: "delete this", "remove that paragraph", "clear everything", "select all text"
- Structure: "make this a heading", "create a bullet list", "add a quote", "make this a code block"
- Alignment: "center this", "align left", "justify the text"
- Lists: "create a numbered list", "make bullet points", "add a list item"

When you detect formatting/manipulation requests, respond with the appropriate action and include a brief confirmation.

${documentId ? 'You are currently working on a document. When asked to write content, write it directly to the document using the phrases above.' : ''}

Current conversation context: ${conversationHistory.length > 0 ? 'Previous messages available - use them to understand references and context' : 'New conversation'}`
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ]

    let content: string
    let metadata: any = {}
    let ragResponse: any = null

    // Check if this is a follow-up question that needs context from previous conversation
    const needsConversationContext = conversationHistory.length > 0 && 
      conversationHistory.some(msg => msg.role === 'assistant' && 
        (msg.content.includes('stock') || msg.content.includes('company') || msg.content.includes('price')))

    if (shouldTriggerRAG) {
      console.log('🔄 Using RAG orchestrator...')
      
      // Create RAG orchestrator
      const orchestrator = createRAGOrchestrator({
        userId: session.user.id,
        documentId,
        maxTokens,
        enableWebSearch: shouldUseWebSearch,
        webSearchTimeout: 15000,
        conversationHistory
      })

      // Process the query with RAG and web search
      ragResponse = await orchestrator.processQuery(message, undefined, session)
      content = ragResponse.content
      metadata = ragResponse.metadata
      
      console.log('✅ RAG Response:', {
        task: metadata.task,
        ragConfidence: metadata.ragConfidence,
        coverage: metadata.coverage,
        sourcesUsed: metadata.sourcesUsed,
        processingTime: metadata.processingTime,
        contentLength: content.length,
        shouldTriggerLiveEdit: metadata.shouldTriggerLiveEdit,
        hasLiveEditContent: !!ragResponse.liveEditContent
      })
    } else {
      console.log('🔄 Using basic chat completion...')
      
      // Add context awareness message if needed
      if (needsConversationContext) {
        messages.push({
          role: 'system',
          content: `IMPORTANT: The user is asking a follow-up question that references something from our previous conversation. Look at the conversation history above to understand what they're referring to (like "this stock", "the company", etc.) and provide a specific answer based on that context.`
        })
      }
      
      // Perform web search using GPT-5 native web search
      let webSearchResults: any[] = []
      let webSearchText = ''
      let webSearchCitations: any[] = []
      
      if (shouldUseWebSearch) {
        try {
          console.log('🔍 Performing GPT-5 web search for:', message)
          
          const webResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/web-search-gpt5`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '', // Pass session cookies
            },
            body: JSON.stringify({ 
              query: message,
              context: {
                has_attached_docs: !!documentId,
                doc_ids: documentId ? [documentId] : [],
                is_selection_present: !!selection && selection.length > 0,
                selection_length: selection?.length || 0,
                recent_tools: [],
                conversation_length: conversationHistory.length,
                user_id: session.user.id,
                document_id: documentId
              }
            })
          })
          
          if (webResponse.ok) {
            const webData = await webResponse.json()
            webSearchText = webData.text || ''
            webSearchCitations = webData.citations || []
            webSearchResults = webData.citations || []
            console.log('✅ GPT-5 web search results:', {
              textLength: webSearchText.length,
              citationsCount: webSearchCitations.length,
              usage: webData.usage
            })
          }
        } catch (error) {
          console.error('❌ Web search failed:', error)
          // Add a note to the system message that web search failed
          messages.push({
            role: 'system',
            content: 'Note: Real-time web search is currently unavailable. Please provide helpful general information and suggest where users can find current data.'
          })
        }
      }

      // Add web search context to the message if we have results
      if (webSearchText && webSearchCitations.length > 0) {
        // Use the GPT-5 generated text directly
        messages[messages.length - 1].content += `\n\n[Current Web Information - Use this real data in your response]:\n${webSearchText}`
        
        // Add citations information
        const citationsText = webSearchCitations.map((citation, index) => 
          `${index + 1}. ${citation.title || citation.domain || 'Source'}: ${citation.url}`
        ).join('\n')
        
        messages[messages.length - 1].content += `\n\n[Sources]:\n${citationsText}`
        
        // Add specific instruction to use the web data
        messages.push({
          role: 'system',
          content: `CRITICAL INSTRUCTION: You have been provided with real, current web data above. You MUST use this actual data in your response. 

REQUIREMENTS:
- Use the specific numbers, prices, and facts from the web sources provided
- Do NOT use placeholder values like "XYZ", "ABC", "$XXX.XX", or generic examples
- Do NOT generate fake or estimated data when real data is available
- If the web data contains specific stock prices, use those exact numbers
- If the web data contains recent news or developments, reference them specifically
- Structure your response as a comprehensive report using the real data provided
- Include the source links in your response when referencing specific information

The web data above contains current, factual information - use it directly in your response.`
        })
      }

      // Generate response
      const response = await generateChatCompletion(messages, {
        model: 'gpt-5-nano-2025-08-07',
        temperature: 0.7,
        max_tokens: maxTokens
      })

      content = response.choices[0]?.message?.content?.trim() || 'No response received'
    }

    console.log('✅ Chat Response:', {
      contentLength: content.length,
      shouldUseWebSearch
    })

    // Check if the response should trigger live editing
    let shouldTriggerLiveEdit = false
    let extractedContent = ''

    // Use router decision for edit requests
    if (isEditRequest) {
      shouldTriggerLiveEdit = true
      extractedContent = extractContentForLiveEdit(content)
    }
    // Use router decision for editor write requests
    else if (isEditorWrite) {
      shouldTriggerLiveEdit = true
      extractedContent = extractContentForLiveEdit(content)
    }
    // If RAG orchestrator was used and it determined live editing should trigger, use its decision
    else if (metadata.shouldTriggerLiveEdit !== undefined) {
      shouldTriggerLiveEdit = metadata.shouldTriggerLiveEdit
      // Use the liveEditContent from RAG orchestrator if available, otherwise extract from content
      extractedContent = ragResponse?.liveEditContent || extractContentForLiveEdit(content)
      
      // Fallback: If extracted content is too short, use the full content
      if (extractedContent.length < 100 && content.length > 100) {
        console.log('⚠️ RAG extracted content too short, using full content')
        extractedContent = content
      }
    } else {
      // Only use fallback detection for non-web-search intents
      // Web search questions should never trigger live editing
      if (routerResult.classification.intent !== 'web_search' && routerResult.classification.intent !== 'ask') {
        const isWritingRequest = message.toLowerCase().includes('write') || 
                               message.toLowerCase().includes('create') || 
                               message.toLowerCase().includes('generate') ||
                               message.toLowerCase().includes('compose') ||
                               message.toLowerCase().includes('draft') ||
                               message.toLowerCase().includes('report') ||
                               message.toLowerCase().includes('document') ||
                               message.toLowerCase().includes('analysis') ||
                               message.toLowerCase().includes('summary')

        const hasTriggerPhrase = content.includes('I\'ll write') || 
                                content.includes('I\'m writing') || 
                                content.includes('Let me write') ||
                                content.includes('Here\'s the') ||
                                content.includes('Here is the') ||
                                content.includes('I\'ll create') ||
                                content.includes('I\'m creating') ||
                                content.includes('I\'ll add') ||
                                content.includes('I\'m adding') ||
                                content.includes('I\'ll insert') ||
                                content.includes('I\'m inserting') ||
                                content.includes('Writing:') ||
                                content.includes('Creating:') ||
                                content.includes('Adding:') ||
                                content.includes('I\'ll provide') ||
                                content.includes('I\'m providing') ||
                                content.includes('Let me provide')

        // Check if content looks like a report or document (long structured content)
        const isStructuredContent = content.length > 500 && (
          content.includes('#') || // Has headers
          content.includes('##') || // Has subheaders
          content.includes('**') || // Has bold text
          content.includes('1.') || // Has numbered lists
          content.includes('- ') || // Has bullet points
          content.includes('|') // Has tables
        )

        // Extract content to check if it's substantial enough for live editing
        extractedContent = extractContentForLiveEdit(content)
        const hasSubstantialContent = extractedContent.length > 50

        // Only trigger live editing if we have both a writing request AND substantial content
        shouldTriggerLiveEdit = (isWritingRequest || hasTriggerPhrase || isStructuredContent) && hasSubstantialContent
      }
    }

    console.log('🔍 Live Editing Detection:', {
      message,
      shouldTriggerLiveEdit,
      contentLength: content.length,
      extractedContentLength: extractedContent.length,
      usingRAGDecision: metadata.shouldTriggerLiveEdit !== undefined,
      ragLiveEditContent: ragResponse?.liveEditContent?.length || 0,
      extractedContentPreview: extractedContent.substring(0, 100) + '...'
    })

    // Debug: Log final response decision
    console.log('🔍 Final Response Decision:', {
      shouldTriggerLiveEdit,
      contentLength: content.length,
      extractedContentLength: extractedContent.length,
      willReturnStatusMessage: shouldTriggerLiveEdit,
      messagePreview: shouldTriggerLiveEdit ? 'Content will be written to the document.' : content.substring(0, 100) + '...'
    })

    const responseData = {
      // If it should trigger live editing, only return a status message, not the full content
      message: shouldTriggerLiveEdit ? 'Content will be written to the document.' : content,
      metadata: {
        task: metadata.task || 'chat',
        useWebSearch: shouldUseWebSearch,
        processingTime: metadata.processingTime || Date.now(),
        shouldTriggerLiveEdit,
        // Include router metadata
        intent: routerResult.classification.intent,
        confidence: routerResult.classification.confidence,
        routerProcessingTime: routerResult.processing_time,
        fallbackUsed: routerResult.fallback_used,
        forceWebSearch,
        // Include RAG metadata if available
        ...(metadata.ragConfidence !== undefined && { ragConfidence: metadata.ragConfidence }),
        ...(metadata.coverage !== undefined && { coverage: metadata.coverage }),
        ...(metadata.sourcesUsed !== undefined && { sourcesUsed: metadata.sourcesUsed })
      },
      // If it should trigger live editing, include the content to be written
      ...(shouldTriggerLiveEdit && {
        liveEditContent: extractedContent
      })
    }

    console.log('🔍 Final API Response:', {
      shouldTriggerLiveEdit,
      hasLiveEditContent: !!responseData.liveEditContent,
      liveEditContentLength: responseData.liveEditContent?.length || 0,
      messageLength: responseData.message.length,
      extractedContentLength: extractedContent.length
    })

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('❌ Chat Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
