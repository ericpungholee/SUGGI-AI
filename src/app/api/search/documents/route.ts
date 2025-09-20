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

        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q')

        if (!query || query.trim().length === 0) {
            return NextResponse.json([])
        }

        const searchTerm = query.trim()

        // Search only in documents
        const documents = await prisma.document.findMany({
            where: {
                userId: session.user.id,
                isDeleted: false,
                OR: [
                    {
                        title: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    {
                        plainText: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    }
                ]
            },
            select: {
                id: true,
                title: true,
                plainText: true,
                wordCount: true,
                isStarred: true,
                updatedAt: true
            },
            take: 50,
            orderBy: {
                updatedAt: 'desc'
            }
        })

        // Transform documents
        const transformedDocuments = documents.map(doc => ({
            id: doc.id,
            type: 'document' as const,
            title: doc.title,
            preview: doc.plainText ? doc.plainText.substring(0, 150) + '...' : 'No content yet...',
            lastModified: getTimeAgo(doc.updatedAt),
            wordCount: doc.wordCount,
            starred: doc.isStarred
        }))

        return NextResponse.json(transformedDocuments)
    } catch (error) {
        console.error('Error searching documents:', error)
        return NextResponse.json(
            { error: 'Failed to perform document search' },
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
