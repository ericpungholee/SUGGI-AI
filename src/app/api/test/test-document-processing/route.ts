import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { processDocumentContent } from "@/lib/ai"

/**
 * Extract text content from document JSON content
 */
function extractTextFromContent(content: any): string {
  if (typeof content === 'string') {
    return content
  }

  if (typeof content === 'object' && content !== null) {
    // Handle different content structures
    if (content.html) {
      return stripHtml(content.html)
    }
    
    if (content.plainText) {
      return content.plainText
    }

    if (content.text) {
      return content.text
    }

    // If it's an array of content blocks
    if (Array.isArray(content)) {
      return content
        .map(block => {
          if (typeof block === 'string') return block
          if (block.text) return block.text
          if (block.content) return block.content
          return ''
        })
        .join('\n')
    }

    // Try to extract text from any nested structure
    return JSON.stringify(content)
  }

  return ''
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

export async function POST(request: Request) {
    try {
        const { documentId } = await request.json()

        if (!documentId) {
            return NextResponse.json(
                { error: "Document ID is required" },
                { status: 400 }
            )
        }

        // Get document
        const document = await prisma.document.findFirst({
            where: {
                id: documentId,
                isDeleted: false
            },
            select: {
                id: true,
                title: true,
                plainText: true,
                content: true
            }
        })

        if (!document) {
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

        // Extract text content using the same logic as document-processor
        const content = document.plainText || extractTextFromContent(document.content)
        
        console.log('Document content length:', content?.length || 0)
        console.log('Document content preview:', content?.substring(0, 100) + '...')

        if (!content || content.trim().length === 0) {
            return NextResponse.json(
                { error: "Document has no content to process" },
                { status: 400 }
            )
        }

        // Test document processing
        console.log('About to call processDocumentContent with:', {
            contentLength: content.length,
            documentId: document.id,
            contentPreview: content.substring(0, 100) + '...'
        })
        
        const chunks = await processDocumentContent(content, document.id)
        
        console.log('processDocumentContent completed, chunks:', chunks.length)
        
        return NextResponse.json({
            success: true,
            message: "Document processing successful",
            document: {
                id: document.id,
                title: document.title,
                contentLength: document.plainText?.length || 0
            },
            chunks: chunks.map(chunk => ({
                id: chunk.id,
                contentLength: chunk.content.length,
                embeddingLength: chunk.embedding.length,
                chunkIndex: chunk.chunkIndex
            })),
            chunkCount: chunks.length
        })
    } catch (error) {
        console.error('Document processing test error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Document processing failed', 
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
