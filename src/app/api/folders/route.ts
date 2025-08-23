import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const folders = await prisma.folder.findMany({
            where: {
                userId: session.user.id,
                isDeleted: false,
                parentId: null // Only top-level folders for now
            },
            orderBy: {
                updatedAt: 'desc'
            },
            select: {
                id: true,
                name: true,
                icon: true,
                _count: {
                    select: {
                        documents: {
                            where: {
                                isDeleted: false
                            }
                        }
                    }
                }
            }
        })

        // Transform the data to match the expected format
        const transformedFolders = folders.map(folder => ({
            id: folder.id,
            name: folder.name,
            count: folder._count.documents.length,
            color: getRandomColor(folder.id) // Generate consistent color based on ID
        }))

        return NextResponse.json(transformedFolders)
    } catch (error) {
        console.error('Error fetching folders:', error)
        return NextResponse.json(
            { error: 'Failed to fetch folders' },
            { status: 500 }
        )
    }
}

function getRandomColor(id: string): string {
    const colors = [
        'bg-blue-100',
        'bg-green-100', 
        'bg-purple-100',
        'bg-amber-100',
        'bg-pink-100',
        'bg-indigo-100',
        'bg-red-100',
        'bg-yellow-100'
    ]
    
    // Use the ID to generate a consistent color
    const hash = id.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0)
        return a & a
    }, 0)
    
    return colors[Math.abs(hash) % colors.length]
}
