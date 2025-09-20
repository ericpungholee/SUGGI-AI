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

        // Search only in folders
        const folders = await prisma.folder.findMany({
            where: {
                userId: session.user.id,
                isDeleted: false,
                name: {
                    contains: searchTerm,
                    mode: 'insensitive'
                }
            },
            select: {
                id: true,
                name: true,
                icon: true,
                updatedAt: true,
                _count: {
                    select: {
                        documents: {
                            where: {
                                isDeleted: false
                            }
                        }
                    }
                }
            },
            take: 50,
            orderBy: {
                updatedAt: 'desc'
            }
        })

        // Transform folders
        const transformedFolders = folders.map(folder => ({
            id: folder.id,
            type: 'folder' as const,
            title: folder.name,
            color: getColorFromIcon(folder.icon),
            lastModified: getTimeAgo(folder.updatedAt),
            count: folder._count.documents
        }))

        return NextResponse.json(transformedFolders)
    } catch (error) {
        console.error('Error searching folders:', error)
        return NextResponse.json(
            { error: 'Failed to perform folder search' },
            { status: 500 }
        )
    }
}

function getColorFromIcon(icon: string | null): string {
    if (!icon) return 'bg-blue-100' // Default color
    
    const colorMap: { [key: string]: string } = {
        'blue': 'bg-blue-100',
        'green': 'bg-green-100',
        'purple': 'bg-purple-100',
        'amber': 'bg-amber-100',
        'pink': 'bg-pink-100',
        'indigo': 'bg-indigo-100',
        'red': 'bg-red-100',
        'yellow': 'bg-yellow-100'
    }
    
    return colorMap[icon] || 'bg-blue-100' // Return mapped color or default
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
