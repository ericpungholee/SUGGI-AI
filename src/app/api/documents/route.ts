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

        // Build where clause
        let whereClause: any = {
            userId: session.user.id,
            isDeleted: false
        }

        // Add filters based on query parameters
        if (starred) {
            whereClause.isStarred = true
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
                createdAt: true
            }
        })

        // Transform the data to match the expected format
        const transformedDocuments = documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            preview: doc.plainText ? doc.plainText.substring(0, 100) + '...' : 'No content yet...',
            lastModified: getTimeAgo(doc.updatedAt),
            wordCount: doc.wordCount,
            starred: doc.isStarred
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

        // Create new document
        const newDocument = await prisma.document.create({
            data: {
                title: title || "Untitled Document",
                content: content || {},
                plainText: content ? content.replace(/<[^>]*>/g, '') : '',
                wordCount: content ? content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0,
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
                createdAt: true
            }
        })

        // Transform the response to match the expected format
        const transformedDocument = {
            id: newDocument.id,
            title: newDocument.title,
            preview: newDocument.plainText ? newDocument.plainText.substring(0, 100) + '...' : 'No content yet...',
            lastModified: getTimeAgo(newDocument.updatedAt),
            wordCount: newDocument.wordCount,
            starred: newDocument.isStarred
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
