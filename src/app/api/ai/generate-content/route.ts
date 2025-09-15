import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateChatCompletion } from '@/lib/ai/openai'

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
    const { message, documentId, editRequest } = body

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

    // Extract document content
    let documentContent = document.plainText || ''
    if (!documentContent && document.content) {
      if (typeof document.content === 'string') {
        documentContent = document.content
      } else if (typeof document.content === 'object' && document.content !== null) {
        const contentObj = document.content as any
        if (contentObj.blocks && Array.isArray(contentObj.blocks)) {
          documentContent = contentObj.blocks
            .map((block: any) => block.text || '')
            .join('\n')
        } else if (contentObj.text) {
          documentContent = contentObj.text
        }
      }
    }

    // Check if this is a delete/clear request
    const isDeleteRequest = message.toLowerCase().includes('delete') || message.toLowerCase().includes('clear')

    // Build system prompt for content generation
    const systemPrompt = isDeleteRequest 
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

Generate the content directly without any introductory phrases, meta-commentary, or explanations.`

    // Generate content using OpenAI
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: message
      }
    ]

    
    const response = await generateChatCompletion(messages, {
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 2000
    })

    const choice = response.choices[0]
    const generatedContent = choice?.message?.content || 'I apologize, but I was unable to generate the requested content.'


    return NextResponse.json({
      content: generatedContent,
      success: true
    })

  } catch (error) {
    console.error('Error generating content:', error)
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    )
  }
}
