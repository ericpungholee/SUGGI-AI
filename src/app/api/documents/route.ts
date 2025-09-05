import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        // Parse query parameters
        const { searchParams } = new URL(request.url)
        const recent = searchParams.get('recent') === 'true'
        const starred = searchParams.get('starred') === 'true'
        const folderId = searchParams.get('folderId')

        // Build where clause
        let whereClause: any = {
            userId: session.user.id,
            isDeleted: false
        }

        // Add filters based on query parameters
        if (starred) {
            whereClause.isStarred = true
        }

        // Filter by folderId if provided
        if (folderId) {
            whereClause.folderId = folderId
        }

        // Build order by clause
        let orderByClause: any[] = []
        
        if (starred) {
            // For starred documents, show most recently updated first
            orderByClause = [
                { updatedAt: 'desc' }
            ]
        } else if (recent) {
            // For recent documents, show most recently updated first
            orderByClause = [
                { updatedAt: 'desc' }
            ]
        } else {
            // Default ordering: starred first, then by creation date
            orderByClause = [
                { isStarred: 'desc' },
                { createdAt: 'desc' }
            ]
        }

        const documents = await prisma.document.findMany({
            where: whereClause,
            orderBy: orderByClause,
            select: {
                id: true,
                title: true,
                plainText: true,
                wordCount: true,
                isStarred: true,
                updatedAt: true,
                createdAt: true,
                folderId: true
            }
        })

        // Transform the data to match the expected format
        const transformedDocuments = documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            preview: doc.plainText ? doc.plainText.substring(0, 100) + '...' : 'No content yet...',
            lastModified: getTimeAgo(doc.updatedAt),
            wordCount: doc.wordCount,
            starred: doc.isStarred,
            folderId: doc.folderId
        }))

        return NextResponse.json(transformedDocuments)
    } catch (error) {
        console.error('Error fetching documents:', error)
        return NextResponse.json(
            { error: 'Failed to fetch documents' },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { title, content, folderId } = await request.json()

        // Check for recent duplicate creation (within last 2 seconds)
        const recentDocument = await prisma.document.findFirst({
            where: {
                userId: session.user.id,
                title: title || "Untitled Document",
                createdAt: {
                    gte: new Date(Date.now() - 2000) // 2 seconds ago
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        if (recentDocument) {
            return NextResponse.json(
                { error: "Document created too recently, please wait" },
                { status: 429 }
            )
        }

        // Validate folderId if provided
        if (folderId) {
            const folder = await prisma.folder.findFirst({
                where: {
                    id: folderId,
                    userId: session.user.id,
                    isDeleted: false
                }
            })
            
            if (!folder) {
                return NextResponse.json(
                    { error: "Folder not found or access denied" },
                    { status: 404 }
                )
            }
        }

        // Ensure content is properly structured
        let documentContent = content || '<p>Start writing your document here...</p>'
        let plainText = ''
        let wordCount = 0

        // Handle different content formats
        if (typeof documentContent === 'string') {
            plainText = documentContent.replace(/<[^>]*>/g, '')
            wordCount = plainText.split(/\s+/).filter(Boolean).length
        } else if (typeof documentContent === 'object' && documentContent.html) {
            plainText = documentContent.html.replace(/<[^>]*>/g, '')
            wordCount = plainText.split(/\s+/).filter(Boolean).length
        }

        // Create new document
        const newDocument = await prisma.document.create({
            data: {
                title: title || "Untitled Document",
                content: {
                    html: documentContent,
                    plainText: plainText,
                    wordCount: wordCount
                },
                plainText: plainText,
                wordCount: wordCount,
                userId: session.user.id,
                folderId: folderId || null
            },
            select: {
                id: true,
                title: true,
                plainText: true,
                wordCount: true,
                isStarred: true,
                updatedAt: true,
                createdAt: true,
                folderId: true
            }
        })

        // Transform the response to match the expected format
        const transformedDocument = {
            id: newDocument.id,
            title: newDocument.title,
            preview: newDocument.plainText ? newDocument.plainText.substring(0, 100) + '...' : 'No content yet...',
            lastModified: getTimeAgo(newDocument.updatedAt),
            wordCount: newDocument.wordCount,
            starred: newDocument.isStarred,
            folderId: newDocument.folderId
        }

        return NextResponse.json(transformedDocument, { status: 201 })
    } catch (error) {
        console.error('Error creating document:', error)
        return NextResponse.json(
            { error: 'Failed to create document' },
            { status: 500 }
        )
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { documentIds, folderId, action } = await request.json()

        if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
            return NextResponse.json(
                { error: "Document IDs array is required" },
                { status: 400 }
            )
        }

        if (!action || !['add', 'remove'].includes(action)) {
            return NextResponse.json(
                { error: "Action must be either 'add' or 'remove'" },
                { status: 400 }
            )
        }

        if (action === 'add') {
            // Validate folderId if adding to folder
            if (!folderId) {
                return NextResponse.json(
                    { error: "Folder ID is required when adding documents" },
                    { status: 400 }
                )
            }

            const folder = await prisma.folder.findFirst({
                where: {
                    id: folderId,
                    userId: session.user.id,
                    isDeleted: false
                }
            })
            
            if (!folder) {
                return NextResponse.json(
                    { error: "Folder not found or access denied" },
                    { status: 404 }
                )
            }

            // Update documents to add them to the folder
            const result = await prisma.document.updateMany({
                where: {
                    id: { in: documentIds },
                    userId: session.user.id,
                    isDeleted: false
                },
                data: {
                    folderId: folderId,
                    updatedAt: new Date()
                }
            })

            return NextResponse.json({
                success: true,
                message: `${result.count} document(s) added to folder`,
                affectedCount: result.count
            })
        } else if (action === 'remove') {
            // Remove documents from folder (set folderId to null)
            const result = await prisma.document.updateMany({
                where: {
                    id: { in: documentIds },
                    userId: session.user.id,
                    isDeleted: false
                },
                data: {
                    folderId: null,
                    updatedAt: new Date()
                }
            })

            return NextResponse.json({
                success: true,
                message: `${result.count} document(s) removed from folder`,
                affectedCount: result.count
            })
        }

    } catch (error) {
        console.error('Error updating documents:', error)
        return NextResponse.json(
            { error: 'Failed to update documents' },
            { status: 500 }
        )
    }
}

function getTimeAgo(date: Date): string {
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMinutes < 60) {
        return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`
    } else if (diffInHours < 24) {
        return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`
    } else if (diffInDays < 7) {
        return diffInDays === 1 ? 'Yesterday' : `${diffInDays} days ago`
    } else {
        return date.toLocaleDateString()
    }
}
