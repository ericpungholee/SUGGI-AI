import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateChatCompletion } from '@/lib/ai/openai'
import { createRAGOrchestrator } from '@/lib/ai/rag-orchestrator'
import { routerService } from '@/lib/ai/router-service'
import { RouterContext } from '@/lib/ai/intent-schema'
import { getChatModel, getRoutingModel } from '@/lib/ai/core/models'

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

/**
 * Determine whether web search results should be delivered as chat response or editor content
 */
async function determineContentDelivery(
  userMessage: string, 
  webSearchText: string, 
  citations: any[], 
  documentId?: string
): Promise<{ shouldGenerateEditorContent: boolean; reason: string }> {
  try {
    const prompt = `Analyze this user request and web search results to determine the best delivery method.

User Request: "${userMessage}"
Web Search Results Length: ${webSearchText.length} characters
Citations Available: ${citations.length}
Has Document Context: ${!!documentId}

DELIVERY OPTIONS:
1. CHAT RESPONSE: For questions, explanations, or when user wants to discuss/understand the information
2. EDITOR CONTENT: For writing requests, reports, documents, or when user wants content added to their document

DECISION CRITERIA:
- If user asks to "write", "create", "generate", "compose", "draft", "report", "document", "analysis", "summary" → EDITOR CONTENT
- If user asks "what", "how", "why", "when", "where", "explain", "tell me about" → CHAT RESPONSE
- If user is asking for current information to discuss/understand → CHAT RESPONSE
- If user wants to create something with the information → EDITOR CONTENT
- If there's a document context AND user wants to write something → EDITOR CONTENT

Respond with ONLY "EDITOR_CONTENT" or "CHAT_RESPONSE" followed by a brief reason.

Examples:
- "Write a report on Tesla stock" → EDITOR_CONTENT - User wants to create a report
- "What is the current Tesla stock price?" → CHAT_RESPONSE - User wants information
- "Create an analysis of the market" → EDITOR_CONTENT - User wants to create content
- "Tell me about recent AI developments" → CHAT_RESPONSE - User wants to discuss/understand
- "Generate a summary of the findings" → EDITOR_CONTENT - User wants to create a summary`

    const response = await generateChatCompletion([
      { role: 'user', content: prompt }
    ], {
      model: getRoutingModel(),
      temperature: 0.1,
      max_tokens: 100
    })

    const decision = response.choices[0]?.message?.content?.trim() || 'CHAT_RESPONSE'
    const shouldGenerateEditorContent = decision.startsWith('EDITOR_CONTENT')
    const reason = decision.includes(' - ') ? decision.split(' - ')[1] : decision

    console.log('🤖 Content Delivery Decision:', {
      userMessage: userMessage.substring(0, 50) + '...',
      decision,
      shouldGenerateEditorContent,
      reason,
      hasDocument: !!documentId
    })

    return { shouldGenerateEditorContent, reason }
  } catch (error) {
    console.error('Error determining content delivery:', error)
    // Default to chat response on error
    return { shouldGenerateEditorContent: false, reason: 'Error in decision logic' }
  }
}

/**
 * Generate formatted content for the editor based on web search results
 */
async function generateEditorContent(
  userMessage: string,
  webSearchText: string,
  citations: any[]
): Promise<string> {
  try {
    const prompt = `Create well-formatted content for a document editor based on the user's request and web search results.

User Request: "${userMessage}"

Web Search Information:
${webSearchText}

Available Sources: ${citations.length} citations

REQUIREMENTS:
- Create comprehensive, well-structured content suitable for a document
- Use markdown formatting (headers, lists, bold, etc.)
- Include the actual data and facts from the web search
- Structure the content logically with clear sections
- Include source citations where appropriate
- Make it ready to insert into a document editor
- Use real data, not placeholders
- Ensure the content directly addresses what the user asked for

FORMATTING GUIDELINES:
- Use # for main headings, ## for subheadings
- Use **bold** for emphasis
- Use bullet points (-) or numbered lists (1.) as appropriate
- Include tables with | if data is tabular
- Add source links in [Source: Title](URL) format when referencing specific information

Create the content now:`

    const response = await generateChatCompletion([
      { role: 'user', content: prompt }
    ], {
      model: getChatModel(),
      temperature: 0.3,
      max_tokens: 3000
    })

    const content = response.choices[0]?.message?.content?.trim() || ''
    
    // Add source citations at the end if not already included
    if (citations.length > 0 && !content.includes('## Sources') && !content.includes('**Sources**')) {
      const sourcesText = `\n\n## Sources\n\n${citations.map((citation, index) => 
        `${index + 1}. [${citation.title || citation.domain || 'Source'}](${citation.url})`
      ).join('\n')}`
      
      return content + sourcesText
    }

    console.log('✅ Generated editor content:', {
      contentLength: content.length,
      hasSources: citations.length > 0,
      contentPreview: content.substring(0, 200) + '...'
    })

    return content
  } catch (error) {
    console.error('Error generating editor content:', error)
    // Fallback to simple formatted web search text
    return `# ${userMessage}\n\n${webSearchText}\n\n## Sources\n\n${citations.map((c, i) => `${i + 1}. [${c.title || c.domain || 'Source'}](${c.url})`).join('\n')}`
  }
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

    // Fast path for simple greetings to avoid heavy routing/RAG
    const isGreeting = (text: string): boolean => {
      const t = (text || '').trim().toLowerCase()
      // Match common short greetings exactly or with simple suffix punctuation
      const patterns = [
        /^hi[!.\s]*$/i,
        /^hello[!.\s]*$/i,
        /^hey[!.\s]*$/i,
        /^(yo|sup|hola)[!.\s]*$/i,
        /^hi there[!.\s]*$/i,
        /^hello there[!.\s]*$/i,
        /^hey there[!.\s]*$/i,
        /^good (morning|afternoon|evening)[!.\s]*$/i
      ]
      // Limit to short messages to reduce false positives
      if (t.length > 30) return false
      return patterns.some((p) => p.test(t))
    }

    if (isGreeting(message)) {
      const name = (session.user as any)?.name || 'there'
      const template = process.env.AI_GREET_TEMPLATE || 'Hey {name}! How can I help you today?'
      const reply = template.replace('{name}', name)
      return NextResponse.json({
        message: reply,
        metadata: {
          task: 'greeting',
          useWebSearch: false,
          processingTime: 0,
          shouldTriggerLiveEdit: false,
          intent: 'ask',
          confidence: 1,
          routerProcessingTime: 0,
          fallbackUsed: false,
          forceWebSearch: false
        }
      })
    }

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

    // OPTIMIZED FLOW: If web search is forced, skip router complexity and go directly to web search
    if (forceWebSearch) {
      console.log('🚀 Direct Web Search Path - Skipping router complexity')
      
      try {
        console.log('🔍 Performing direct GPT-5 web search for:', message)
        
        // Use direct web search instead of API call
        const { webSearch } = await import('@/lib/ai/services/web-search')
        const webData = await webSearch({
          prompt: `Search for current information about: ${message}`,
          model: getChatModel(),
          maxResults: 8,
          includeImages: false,
          searchRegion: 'US',
          language: 'en',
          timeoutMs: 15000
        })
        
        const webSearchText = webData.text || ''
        const webSearchCitations = webData.citations || []
          
          console.log('✅ Direct web search results:', {
            textLength: webSearchText.length,
            citationsCount: webSearchCitations.length,
            usage: webData.usage
          })

          // Smart decision: Determine if this should be chat response or editor content
          const contentDecision = await determineContentDelivery(message, webSearchText, webSearchCitations, documentId)
          
          if (contentDecision.shouldGenerateEditorContent) {
            // Generate content for editor
            const editorContent = await generateEditorContent(message, webSearchText, webSearchCitations)
            return NextResponse.json({
              message: 'Content will be written to the document.',
              liveEditContent: editorContent,
              metadata: {
                task: 'editor_write',
                useWebSearch: true,
                processingTime: Date.now(),
                shouldTriggerLiveEdit: true,
                intent: 'direct_web_search',
                confidence: 1.0,
                routerProcessingTime: 0,
                fallbackUsed: false,
                forceWebSearch: true,
                sourcesUsed: webSearchCitations.length,
                webSearchResults: webSearchCitations.length
              }
            })
          } else {
            // Return as chat response
            return NextResponse.json({
              message: webSearchText + (webSearchCitations.length > 0 ? `\n\nSources:\n${webSearchCitations.map((c: any, i: number) => `${i + 1}. ${c.title || c.domain || 'Source'}: ${c.url}`).join('\n')}` : ''),
              metadata: {
                task: 'web_search',
                useWebSearch: true,
                processingTime: Date.now(),
                shouldTriggerLiveEdit: false,
                intent: 'direct_web_search',
                confidence: 1.0,
                routerProcessingTime: 0,
                fallbackUsed: false,
                forceWebSearch: true,
                sourcesUsed: webSearchCitations.length,
                webSearchResults: webSearchCitations.length
              }
            })
          }
      } catch (error) {
        console.error('❌ Direct web search failed:', error)
        // Fallback to regular flow
      }
    }

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
        content: `You are an AI writing assistant with advanced document manipulation capabilities powered by GPT-5 (October 2025). You help users write, edit, and format documents with real-time web search capabilities.

Key behaviors:
- When asked to write reports, research, or content, ALWAYS start your response with phrases like "I'll write:", "I'm writing:", "Let me write:", "Here's the content:", "I'll create:", "I'm creating:", "I'll add:", "I'm adding:", "I'll insert:", "I'm inserting:", "Writing:", "Creating:", or "Adding:"
- Don't ask for confirmation - just start writing immediately
- Use current, real-time information from October 2025 when available through web search
- Be helpful and direct with factual, up-to-date information
- Format content properly with markdown when appropriate
- Remember conversation context and build upon previous messages
- If user says "go ahead" or similar, proceed with the previous request
- ALWAYS include the actual content to be written after your introductory phrase
- For editor_write intents, focus on creating comprehensive, well-structured content

CRITICAL: Use ONLY real, current data from October 2025 in your responses. Never use placeholder values like "XYZ", "ABC", or generic examples. Use actual stock symbols, real company names, and current financial data. You have access to real-time web search for the most up-to-date information.

CONTEXT AWARENESS:
- Pay close attention to previous conversation messages to understand references
- When user says "this stock", "the company", "it", etc., refer back to the conversation history to identify what they're referring to
- If previous messages discussed specific companies (like Tesla/TSLA), use that context when answering follow-up questions
- Maintain continuity across the conversation

WEB SEARCH INTEGRATION (October 2025):
- You have access to GPT-5's enhanced web search capabilities
- Use real-time data for current events, stock prices, news, and factual information
- Always verify information with multiple sources when possible
- Include source citations when referencing web data
- Prioritize authoritative and recent sources

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
      conversationHistory.some((msg: any) => msg.role === 'assistant' && 
        (msg.content.includes('stock') || msg.content.includes('company') || msg.content.includes('price')))

    if (isEditorWrite) {
      // One-shot compose: plan, gather (RAG+Web), compose markdown, return approval card with sources
      console.log('🧪 One-shot compose triggered')
      try {
        const { oneShotCompose } = await import('@/lib/ai/one-shot-compose')
        const selectedDocs = routerContext.doc_ids || []
        const useDocs = selectedDocs.length > 0 || routerResult.classification.intent === 'rag_query'
        const useWeb = forceWebSearch || routerResult.classification.slots.needs_recency || true
        const compose = await oneShotCompose({
          topic: message,
          grounding: { use_docs: useDocs, use_web: useWeb, docs: selectedDocs },
          timeBudgetMs: 20_000, // Reduced from 35s to 20s
          editorDocId: documentId || undefined
        })

        // Return approval payload (do not paste draft in chat)
        return NextResponse.json({
          message: 'Draft ready. Review and Approve to insert into the editor.',
          approval: {
            draft: true,
            title: 'AI Draft',
            summary: 'A one-shot draft was created using saved docs and web sources.',
            sources: compose.sources,
            markdown: compose.markdown
          },
          metadata: {
            task: 'editor_write',
            useWebSearch: useWeb,
            shouldTriggerLiveEdit: false,
            intent: routerResult.classification.intent,
            confidence: routerResult.classification.confidence,
            routerProcessingTime: routerResult.processing_time,
            fallbackUsed: routerResult.fallback_used,
            forceWebSearch
          }
        })
      } catch (e) {
        console.error('One-shot compose error:', e)
        // Fallback to legacy path
      }
    }

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
          console.log('🔍 Performing direct GPT-5 web search for:', message)
          
          // Use direct web search instead of API call to avoid circular dependency
          const { webSearch } = await import('@/lib/ai/services/web-search')
          const webData = await webSearch({
            prompt: `Search for current information about: ${message}`,
            model: getChatModel(),
            maxResults: 8,
            includeImages: false,
            searchRegion: 'US',
            language: 'en',
            timeoutMs: 15000 // Shorter timeout for direct calls
          })
          
          webSearchText = webData.text || ''
          webSearchCitations = webData.citations || []
          webSearchResults = webData.citations || []
          console.log('✅ GPT-5 web search results:', {
            textLength: webSearchText.length,
            citationsCount: webSearchCitations.length,
            usage: webData.usage
          })
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
          content: `CRITICAL INSTRUCTION: You have been provided with real, current web data from October 2025 above. You MUST use this actual data in your response. 

REQUIREMENTS:
- Use the specific numbers, prices, and facts from the web sources provided
- Do NOT use placeholder values like "XYZ", "ABC", "$XXX.XX", or generic examples
- Do NOT generate fake or estimated data when real data is available
- If the web data contains specific stock prices, use those exact numbers
- If the web data contains recent news or developments, reference them specifically
- Structure your response as a comprehensive report using the real data provided
- Include the source links in your response when referencing specific information
- Emphasize the current date context (October 2025) when relevant
- Highlight any recent developments or changes mentioned in the sources

The web data above contains current, factual information from October 2025 - use it directly in your response.`
        })
      }

      // If we have concrete web search text, prefer returning it directly for accuracy
      if (shouldUseWebSearch && webSearchText) {
        content = webSearchText
        // If we have citations, append them to ensure sources are visible
        if (webSearchCitations && webSearchCitations.length > 0) {
          const citationsText = webSearchCitations.map((citation: any, index: number) => 
            `${index + 1}. ${citation.title || citation.domain || 'Source'}: ${citation.url}`
          ).join('\n')
          content += `\n\nSources:\n${citationsText}`
        }
      } else {
        // Generate response
        const response = await generateChatCompletion(messages, {
          model: getChatModel(),
          temperature: 0.7,
          max_tokens: maxTokens
        })

        content = response.choices[0]?.message?.content?.trim() || 'No response received'
      }
    }

    console.log('✅ Chat Response:', {
      contentLength: content.length,
      shouldUseWebSearch
    })

    // Check if the response should trigger live editing
    let shouldTriggerLiveEdit = false
    let extractedContent = ''

    // Use router decision for edit requests, but guard against short or random inputs
    const isShortOrRandom = message.trim().length < 15
    if (isEditRequest && !isShortOrRandom) {
      shouldTriggerLiveEdit = true
      extractedContent = extractContentForLiveEdit(content)
    }
    // Use router decision for editor write requests with the same guard
    else if (isEditorWrite && !isShortOrRandom) {
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
      if (routerResult.classification.intent !== 'web_search' && routerResult.classification.intent !== 'ask' && !isShortOrRandom) {
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
