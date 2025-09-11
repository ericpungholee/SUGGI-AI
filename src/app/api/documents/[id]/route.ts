import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { id } = await params

        // Get the document
        const document = await prisma.document.findFirst({
            where: {
                id: id,
                userId: session.user.id,
                isDeleted: false
            },
            select: {
                id: true,
                title: true,
                content: true,
                plainText: true,
                wordCount: true,
                isStarred: true,
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

        console.log('API: Document content structure:', {
            id: document.id,
            title: document.title,
            contentType: typeof document.content,
            content: document.content,
            plainText: document.plainText,
            wordCount: document.wordCount
        })

        return NextResponse.json(document)
    } catch (error) {
        console.error('Error fetching document:', error)
        return NextResponse.json(
            { error: 'Failed to fetch document' },
            { status: 500 }
        )
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { id } = await params
        const { title, content, plainText, wordCount, isStarred, folderId } = await request.json()

        // Verify the document belongs to the user
        const existingDocument = await prisma.document.findFirst({
            where: {
                id: id,
                userId: session.user.id,
                isDeleted: false
            }
        })

        if (!existingDocument) {
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

        // If moving to a different folder, verify the folder exists and belongs to the user
        if (folderId !== undefined && folderId !== existingDocument.folderId) {
            if (folderId) {
                const targetFolder = await prisma.folder.findFirst({
                    where: {
                        id: folderId,
                        userId: session.user.id,
                        isDeleted: false
                    }
                })
                
                if (!targetFolder) {
                    return NextResponse.json(
                        { error: "Target folder not found" },
                        { status: 404 }
                    )
                }
            }
        }

        // Prepare update data with proper content structure
        const updateData: any = {
            updatedAt: new Date()
        }

        if (title !== undefined) {
            updateData.title = title
        }

        if (content !== undefined) {
            // Ensure content is properly structured
            if (typeof content === 'string') {
                updateData.content = {
                    html: content,
                    plainText: content.replace(/<[^>]*>/g, ''),
                    wordCount: content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length
                }
            } else if (typeof content === 'object' && content.html) {
                updateData.content = content
            }
            
            console.log('API: Saving content structure:', {
                originalContent: content,
                updateDataContent: updateData.content,
                contentType: typeof updateData.content
            })
        }

        if (plainText !== undefined) {
            updateData.plainText = plainText
        }

        if (wordCount !== undefined) {
            updateData.wordCount = wordCount
        }

        if (isStarred !== undefined) {
            updateData.isStarred = isStarred
        }

        if (folderId !== undefined) {
            updateData.folderId = folderId
        }

        // Update the document
        const updatedDocument = await prisma.document.update({
            where: {
                id: id
            },
            data: updateData,
            select: {
                id: true,
                title: true,
                content: true,
                plainText: true,
                wordCount: true,
                isStarred: true,
                updatedAt: true,
                createdAt: true,
                folderId: true
            }
        })

        // Trigger vectorization in the background if content was updated
        if (content !== undefined) {
            try {
                const { processDocument } = await import("@/lib/ai")
                // Force re-vectorization when content changes to ensure new content is indexed
                processDocument(id, session.user.id, { 
                    forceReprocess: true, 
                    useIncremental: false 
                }).catch(error => {
                    console.error('Background vectorization failed:', error)
                })
                console.log(`Triggered force re-vectorization for document ${id}`)
            } catch (error) {
                console.error('Error starting background vectorization:', error)
            }
        }

        return NextResponse.json(updatedDocument)
    } catch (error) {
        console.error('Error updating document:', error)
        return NextResponse.json(
            { error: 'Failed to update document' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { id } = await params

        // Verify the document belongs to the user
        const existingDocument = await prisma.document.findFirst({
            where: {
                id: id,
                userId: session.user.id,
                isDeleted: false
            }
        })

        if (!existingDocument) {
            return NextResponse.json(
                { error: "Document not found" },
                { status: 404 }
            )
        }

        // Soft delete the document
        await prisma.document.update({
            where: {
                id: id
            },
            data: {
                isDeleted: true,
                deletedAt: new Date()
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting document:', error)
        return NextResponse.json(
            { error: 'Failed to delete document' },
            { status: 500 }
        )
    }
}
