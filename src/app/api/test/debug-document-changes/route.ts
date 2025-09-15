import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { trackDocumentChanges, needsRevectorization } from "@/lib/ai/document-change-tracker"
import { processDocument } from "@/lib/ai/document-processor"

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { documentId } = await request.json()

        if (!documentId) {
            return NextResponse.json(
                { error: "Document ID is required" },
                { status: 400 }
            )
        }

        console.log('=== DEBUG DOCUMENT CHANGES ===')
        console.log('Document ID:', documentId)
        console.log('User ID:', session.user.id)

        // Get document details
        const document = await prisma.document.findFirst({
            where: {
                id: documentId,
                userId: session.user.id,
                isDeleted: false
            },
            select: {
                id: true,
                title: true,
                content: true,
                plainText: true,
                isVectorized: true,
                updatedAt: true,
                createdAt: true
            }
        })

        if (!document) {
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

        console.log('Document found:', document.title)
        console.log('Is vectorized:', document.isVectorized)
        console.log('Has plainText:', !!document.plainText)
        console.log('Content type:', typeof document.content)
        console.log('Last updated:', document.updatedAt)

        // Get document versions
        const versions = await prisma.documentVersion.findMany({
            where: { documentId },
            orderBy: { createdAt: 'desc' },
            take: 3
        })

        console.log('Document versions:', versions.length)
        versions.forEach((version, index) => {
            console.log(`Version ${index + 1}:`, {
                createdAt: version.createdAt,
                contentHash: version.contentHash,
                chunksCount: version.chunksCount
            })
        })

        // Get document chunks
        const chunks = await prisma.documentChunk.findMany({
            where: { documentId },
            orderBy: { chunkIndex: 'asc' }
        })

        console.log('Document chunks:', chunks.length)
        if (chunks.length > 0) {
            console.log('First chunk preview:', chunks[0].content.substring(0, 100) + '...')
            console.log('Last chunk preview:', chunks[chunks.length - 1].content.substring(0, 100) + '...')
        }

        // Check if needs re-vectorization
        const content = document.plainText || (typeof document.content === 'string' ? document.content : JSON.stringify(document.content))
        const needsRevector = await needsRevectorization(documentId, content)
        console.log('Needs re-vectorization:', needsRevector)

        // Check for changes
        const changes = await trackDocumentChanges(documentId, content)
        console.log('Detected changes:', changes.length)
        changes.forEach((change, index) => {
            console.log(`Change ${index + 1}:`, {
                type: change.type,
                startIndex: change.startIndex,
                endIndex: change.endIndex,
                contentPreview: change.newContent?.substring(0, 100) + '...'
            })
        })

        // Try to process the document
        try {
            console.log('Attempting to process document...')
            await processDocument(documentId, session.user.id, { 
                useIncremental: true, 
                forceReprocess: true 
            })
            console.log('Document processed successfully')
        } catch (error) {
            console.error('Error processing document:', error)
        }

        return NextResponse.json({
            success: true,
            document: {
                id: document.id,
                title: document.title,
                isVectorized: document.isVectorized,
                hasPlainText: !!document.plainText,
                contentType: typeof document.content,
                lastUpdated: document.updatedAt,
                versionsCount: versions.length,
                chunksCount: chunks.length,
                needsRevectorization: needsRevector,
                changesDetected: changes.length,
                changes: changes.map(change => ({
                    type: change.type,
                    startIndex: change.startIndex,
                    endIndex: change.endIndex,
                    contentPreview: change.newContent?.substring(0, 100) + '...'
                }))
            }
        })
    } catch (error) {
        console.error('Debug document changes error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Debug failed', 
                details: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
