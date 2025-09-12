import { NextResponse } from "next/server"
import { generateChatCompletion, ChatMessage } from "@/lib/ai"
import { searchWeb, formatSearchResultsForAI } from "@/lib/ai"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { message = 'what is Y Combinator', useWebSearch = false } = body

        console.log('Testing web toggle with message:', message, 'useWebSearch:', useWebSearch)

        // Check if this is a general knowledge query
        function isGeneralKnowledgeQuery(message: string): boolean {
            const generalKnowledgePatterns = [
                /^who is/i,
                /^what is/i,
                /^when did/i,
                /^where is/i,
                /^how does/i,
                /^why did/i,
                /^tell me about/i,
                /^explain/i,
                /^define/i,
                /^describe/i,
                /^what are/i,
                /^who are/i,
                /^when was/i,
                /^where are/i,
                /^how are/i,
                /^why are/i,
                /^can you tell me/i,
                /^do you know/i,
                /^what do you know about/i,
                /^who was/i,
                /^what was/i,
                /^when was/i,
                /^where was/i,
                /^how was/i,
                /^why was/i
            ]

            const messageLower = message.toLowerCase().trim()
            
            for (const pattern of generalKnowledgePatterns) {
                if (pattern.test(messageLower)) {
                    return true
                }
            }

            return false
        }

        // Get context based on user preference
        let context = ''
        let contextSource = 'none'
        let contextUsed: string[] = []
        
        const isGeneralQuery = isGeneralKnowledgeQuery(message)
        console.log('Is general query:', isGeneralQuery)

        // If user explicitly wants web search, use it
        if (useWebSearch) {
            try {
                console.log('User requested web search for:', message)
                const webResults = await searchWeb(message, { limit: 5 })
                if (webResults && webResults.length > 0) {
                    context = formatSearchResultsForAI(webResults)
                    contextUsed = [context]
                    contextSource = 'web'
                    console.log('Web search successful, found', webResults.length, 'results')
                }
            } catch (webSearchError) {
                console.warn('Web search failed:', webSearchError)
            }
        }
        // For general knowledge queries without web search, use model's general knowledge
        else if (isGeneralQuery) {
            console.log('General knowledge query detected, using model knowledge for:', message)
            // No context will be provided, AI will use its general knowledge
        }

        // Build system prompt
        let systemPrompt = `You are an advanced AI writing assistant specialized in Retrieval-Augmented Generation (RAG). You excel at understanding document context, providing accurate information, and helping with complex writing tasks.

Your capabilities:
- Analyze and understand document content with high accuracy using retrieved context
- Answer questions based on retrieved context with proper citations and source attribution
- Help improve writing quality, grammar, and style based on document content
- Generate content that's contextually relevant and well-structured
- Provide research assistance with proper source attribution
- Suggest improvements and alternatives with clear reasoning
- Synthesize information from multiple document sources when available
- Answer general knowledge questions using web search results when document context is not available

Guidelines for accuracy and context usage:
- ALWAYS prioritize information from the provided context over general knowledge
- When document context is provided, base your responses primarily on it and cite specific sources
- When web search context is provided, use the search results to answer general knowledge questions
- Use direct quotes from the context when appropriate, with proper attribution
- If the context contains multiple documents or sources, clearly distinguish between them in your responses
- When no context is available, clearly state this limitation and provide general assistance based on your training knowledge
- Be specific and actionable in your suggestions, always explaining your reasoning
- Maintain a professional but approachable tone
- Be precise and avoid making assumptions not supported by the context
- When suggesting changes, explain your reasoning and reference specific parts of the context

IMPORTANT - Source Citation Rules:
- When citing document sources, ALWAYS refer to documents by their TITLE/NAME, never by ID
- When citing web sources, use phrases like "According to [Source Title]" or "As mentioned in [Source Title]"
- Use phrases like "According to [Document Title]" or "As mentioned in [Document Title]" for documents
- If you need to reference specific sections, say "In [Source Title], section X" or "From [Source Title]"
- Never mention document IDs, internal references, or technical identifiers to the user

Response format:
- Start with a direct answer to the user's question
- Support your answer with specific references to the context using source TITLES
- Provide additional insights or suggestions when relevant
- End with actionable next steps if appropriate`

        if (context) {
            if (contextSource === 'web') {
                systemPrompt += `\n\n=== WEB SEARCH RESULTS ===\n${context}\n\nCRITICAL INSTRUCTIONS FOR WEB SEARCH RESULTS:
- You MUST use the information from these web search results to answer the user's question
- Base your response primarily on the content provided in the search results above
- When citing information, use the exact titles from the search results (e.g., "According to [Title]")
- Include specific details, facts, and data from the search results
- If the search results contain multiple sources, reference them appropriately
- Do NOT provide generic responses - use the specific information provided
- If you need to make inferences, clearly state that you're drawing conclusions based on the available search results`
            } else {
                systemPrompt += `\n\n=== RELEVANT DOCUMENT CONTEXT ===\n${context}\n\nIMPORTANT: Use this context as your primary source of information. When citing sources, ALWAYS use the document TITLES (the text in bold **Title**) that appear in the context above, never use document IDs or internal references. If you need to make inferences, clearly state that you're drawing conclusions based on the available context.`
            }
        } else {
            if (isGeneralQuery) {
                systemPrompt += `\n\nYou are answering a general knowledge question. Use your training knowledge to provide a comprehensive and accurate response. You do not have access to specific document context or web search results, so base your answer on your general knowledge.`
            } else {
                systemPrompt += `\n\nWARNING: No specific context was retrieved for this query. You can still provide helpful assistance based on your general knowledge, but you MUST clearly state that you don't have access to specific context and that your response is based on general knowledge only.`
            }
        }

        // Build messages for AI
        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: message
            }
        ]

        // Generate AI response
        const startTime = Date.now()
        let response: any
        let aiMessage = 'I apologize, but I was unable to generate a response.'

        try {
            response = await generateChatCompletion(messages, {
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
                max_tokens: 1000
            })

            aiMessage = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.'
        } catch (generationError) {
            console.error('AI generation failed:', generationError)
            aiMessage = `Error: ${generationError instanceof Error ? generationError.message : 'Unknown error'}`
        }

        const responseTime = Date.now() - startTime

        return NextResponse.json({
            success: true,
            message: aiMessage,
            contextSource,
            hasContext: !!context,
            isGeneralQuery,
            useWebSearch,
            responseTime,
            contextUsed: contextUsed.length,
            tokenUsage: response?.usage ? {
                prompt: response.usage.prompt_tokens,
                completion: response.usage.completion_tokens,
                total: response.usage.total_tokens
            } : undefined
        })
    } catch (error) {
        console.error('Web toggle test error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Web toggle test failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
