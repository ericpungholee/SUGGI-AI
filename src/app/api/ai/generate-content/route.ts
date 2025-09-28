import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateChatCompletion, ChatMessage } from '@/lib/ai/openai'
import { parseTableRequest, generateTableHTML, generateTableFromSpec } from '@/lib/ai/table-utils'
import { processTableEditRequest } from '@/lib/ai/table-editing-utils'

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
    const { message, documentId, editRequest, isMultiStepWorkflow, requiresWebSearch } = body

    if (!message || !documentId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get document content for context
    const { prisma } = await import('@/lib/prisma')
    
    const document = await prisma.document.findUnique({
      where: { id: documentId, userId: session.user.id },
      select: { plainText: true, content: true, title: true }
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Extract document content - prioritize HTML content for table editing
    let documentContent = ''
    
    // First try to get HTML content from document.content
    if (document.content) {
      if (typeof document.content === 'string') {
        documentContent = document.content
      } else if (typeof document.content === 'object' && document.content !== null) {
        const contentObj = document.content as any
        if (contentObj.html) {
          documentContent = contentObj.html
        } else if (contentObj.blocks && Array.isArray(contentObj.blocks)) {
          // Try to reconstruct HTML from blocks
          documentContent = contentObj.blocks
            .map((block: any) => block.html || block.text || '')
            .join('')
        } else if (contentObj.text) {
          documentContent = contentObj.text
        }
      }
    }
    
    // Fallback to plainText if no HTML content found
    if (!documentContent) {
      documentContent = document.plainText || ''
    }
    
    console.log('📄 Document content type:', typeof document.content)
    console.log('📄 Document content preview:', documentContent.substring(0, 200))

    let generatedContent = ''

    // Check if this is a web search table request
    const lowerMessage = message.toLowerCase()
    const isWebSearchTableRequest = lowerMessage.includes('research') || lowerMessage.includes('search') || 
                                   lowerMessage.includes('web') || lowerMessage.includes('look up') ||
                                   lowerMessage.includes('find') || lowerMessage.includes('get') ||
                                   lowerMessage.includes('based on') || lowerMessage.includes('from the data') ||
                                   lowerMessage.includes('do a research') || lowerMessage.includes('research on')
    
    // Only perform web search if explicitly required OR if it's a web search table request
    const shouldPerformWebSearch = (isMultiStepWorkflow && requiresWebSearch) || isWebSearchTableRequest
    
    console.log('🔍 Web search decision:', {
      isMultiStepWorkflow,
      requiresWebSearch,
      isWebSearchTableRequest,
      shouldPerformWebSearch,
      message: message.substring(0, 100) + '...'
    })
    
    // Initialize webSearchResults variable
    let webSearchResults = ''
    
    // For web search requests, we'll let GPT handle it natively instead of manual search
    if (shouldPerformWebSearch) {
      console.log('🌐 Web search request detected: will use GPT native web search')
      // Don't do manual web search - let GPT handle it natively
      // webSearchResults will remain empty as GPT will handle web search natively
    } else {
      console.log('⏭️ Skipping web search - not required for this request')
    }

    // Check for "delete everything except table" requests first (before table editing logic)
    const isDeleteExceptTable = (
      lowerMessage.includes('delete everything') && lowerMessage.includes('except') && lowerMessage.includes('table')
    ) || (
      lowerMessage.includes('clear everything') && lowerMessage.includes('except') && lowerMessage.includes('table')
    ) || (
      lowerMessage.includes('remove everything') && lowerMessage.includes('except') && lowerMessage.includes('table')
    )
    
    if (isDeleteExceptTable) {
      console.log('🗑️ API: Detected "delete everything except table" request')
      
      // Extract table content from the document
      const tableMatch = documentContent.match(/<table[^>]*>[\s\S]*?<\/table>/gi)
      if (tableMatch && tableMatch.length > 0) {
        // Preserve all tables found in the document
        generatedContent = tableMatch.join('\n')
        console.log('✅ API: Preserved table content:', generatedContent.substring(0, 200) + '...')
      } else {
        // No table found, return empty content
        generatedContent = ''
        console.log('⚠️ API: No table found in document, returning empty content')
      }
    }
    // Check if this is a table editing request for existing tables (skip for delete except table)
    else if (!isDeleteExceptTable) {
      console.log('🔍 API: Checking for table edit request:', { message, contentLength: documentContent.length })
      
      // First check if this is a new table creation request
      // Parse table request from the message and document content
      const tableSpec = parseTableRequest(message, documentContent)
      if (tableSpec) {
        console.log('✅ API: Parsed table specification:', { 
          rows: tableSpec.rows, 
          cols: tableSpec.cols, 
          hasHeaders: tableSpec.hasHeaders,
          hasContent: !!tableSpec.content,
          contentPreview: tableSpec.content?.slice(0, 2)
        })
        
        // Generate table HTML directly using the parsed data
        generatedContent = generateTableFromSpec(tableSpec)
        console.log('✅ API: Generated table HTML from spec')
      } else {
        // Check for existing table editing
        console.log('🔍 API: About to call processTableEditRequest...')
        const tableEditResult = await processTableEditRequest(message, documentContent)
        console.log('📊 API: Table edit result:', { isTableEdit: tableEditResult.isTableEdit, hasEditedContent: !!tableEditResult.editedContent })
        
        if (tableEditResult.isTableEdit) {
          // For table editing, return the edited content
          generatedContent = tableEditResult.editedContent
          console.log('✅ API: Using table edit result as generated content')
        }
      }
    }
    
    // If no content generated yet (including multi-step workflows), generate content
    if (!generatedContent) {
      console.log('🔄 Generating content with web search results:', {
        hasWebSearchResults: !!webSearchResults,
        webSearchLength: webSearchResults.length,
        isMultiStepWorkflow,
        requiresWebSearch
      })
      
      // Check if this is a delete/clear request
      // More sophisticated delete request detection
      const lowerMessage = message.toLowerCase()
      const isDeleteRequest = (
        lowerMessage.includes('delete everything') && !lowerMessage.includes('except') && !lowerMessage.includes('keep') && !lowerMessage.includes('preserve')
      ) || (
        lowerMessage.includes('clear') && !lowerMessage.includes('except') && !lowerMessage.includes('keep') && !lowerMessage.includes('preserve')
      ) || (
        lowerMessage.includes('remove all') && !lowerMessage.includes('except') && !lowerMessage.includes('keep') && !lowerMessage.includes('preserve')
      )

      // Build system prompt for content generation using instruction framework
      let systemPrompt: string

      // Build system prompt for content generation
      if (editRequest?.instruction) {
        console.log('Using instruction-based content generation')
        
        systemPrompt = `You are an AI writing assistant executing a document editing instruction.

INSTRUCTION: ${editRequest.instruction.intent || 'Edit document'}
SCOPE: ${editRequest.instruction.scope || 'document'}

DOCUMENT CONTEXT:
${documentContent.substring(0, 2000)}${documentContent.length > 2000 ? '...' : ''}

USER REQUEST: "${message}"

Generate the requested content based on the instruction and document context.`
        
        // Add web search results if available
        if (webSearchResults) {
          systemPrompt += `\n\nWEB SEARCH RESULTS:
${webSearchResults}

IMPORTANT: Use the web search results above to create accurate, up-to-date content. The search results contain current information that should be incorporated into your response.`
        }
      } else {
        // Fallback to the original system prompt
        systemPrompt = isDeleteRequest 
          ? `You are an AI writing assistant. The user has requested to delete or clear all content from their document.

User request: "${message}"

CRITICAL RULES FOR DELETE REQUESTS:
1. Generate EMPTY content - return nothing, no text, no content
2. Do NOT include any meta-commentary, explanations, or reports
3. Do NOT include phrases like "I've deleted", "Content cleared", etc.
4. Return completely empty content as requested
5. The user wants the document to be empty

Generate empty content (return nothing).`
          : `You are an AI writing assistant. Generate ONLY the substantive content requested by the user.

User request: "${message}"

Document context:
Title: ${document.title || 'Untitled Document'}
Existing content: ${documentContent.substring(0, 2000)}${documentContent.length > 2000 ? '...' : ''}

${webSearchResults ? `\n\nWEB SEARCH RESULTS:
${webSearchResults}

IMPORTANT: Use the web search results above to create accurate, up-to-date content. The search results contain current information that should be incorporated into your response.` : ''}

${isMultiStepWorkflow && requiresWebSearch ? `
MULTI-STEP WORKFLOW INSTRUCTIONS:
- You are processing a data query that requires web search + content generation
- The user wants current/real data, not generic examples
- Create a well-formatted table with the actual data from the web search results
- Use proper HTML table structure with headers and data rows
- Include specific numbers, dates, and facts from the search results
- Format financial data with appropriate symbols ($, %, etc.)
- Make the table professional and easy to read
- DO NOT ask questions or ask for clarification - just provide the data
- DO NOT generate meta-commentary about what you're doing
- Generate ONLY the actual content requested
` : ''}

CRITICAL RULES:
1. Generate ONLY the actual content requested - no meta-commentary, explanations, or reports
2. Do NOT include phrases like "Here's the content", "I've generated", "This document", etc.
3. Do NOT reference the document title or existing content in a meta way
4. Do NOT include any user-facing messages or status updates
5. Write as if you are the author of the document, not an AI assistant
6. Generate substantive, well-structured content about the requested topic
7. If asked to delete content, generate empty content or a fresh start
8. If asked to write about a topic, write directly about that topic
9. If the document has existing content, seamlessly continue from where it left off
10. FORMATTING: Use proper paragraph breaks (double line breaks) between paragraphs
11. CONTEXT AWARENESS: Consider the existing content and writing style when generating new content
12. INTEGRATION: If adding to existing content, make sure the new content flows naturally with what's already there
13. STRUCTURE: Use clear paragraph structure with proper spacing between ideas
14. NO QUESTIONS: Do NOT ask questions, ask for clarification, or ask what the user wants
15. NO META-COMMENTARY: Do NOT explain what you're doing or ask for confirmation
${webSearchResults ? '16. WEB DATA: Use the web search results to provide accurate, current information' : ''}

Generate the content directly without any introductory phrases, meta-commentary, explanations, or questions.`
      }

      // Generate content using OpenAI
      const messages: ChatMessage[] = [
        {
          role: 'system' as const,
          content: systemPrompt
        },
        {
          role: 'user' as const,
          content: message
        }
      ]

      console.log('🤖 Calling OpenAI with model:', process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini')
      console.log('🌐 Web search enabled:', shouldPerformWebSearch)
      
      const response = await generateChatCompletion(messages, {
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        temperature: 0.2, // Very low temperature for precise, consistent content generation
        max_tokens: 2000,
        useWebSearch: shouldPerformWebSearch // Enable GPT native web search when needed
      })

      console.log('✅ OpenAI response received:', {
        hasChoices: !!response.choices,
        choicesLength: response.choices?.length,
        firstChoiceContent: response.choices?.[0]?.message?.content?.substring(0, 100)
      })

      const choice = response.choices[0]
      generatedContent = choice?.message?.content || 'I apologize, but I was unable to generate the requested content.'
      
      // Clean up the generated content
      generatedContent = generatedContent
        .replace(/\|+/g, '') // Remove pipe characters that cause blue line artifacts
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
      
      console.log('📝 Generated content preview:', generatedContent.substring(0, 500) + '...')
      console.log('📊 Generated content length:', generatedContent.length)
      }

    return NextResponse.json({
      content: generatedContent,
      success: true
    })

  } catch (error) {
    console.error('❌ Error generating content:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    
    // Return more specific error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { 
        error: 'Failed to generate content',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
