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
        const parentId = searchParams.get('parentId')

        const folders = await prisma.folder.findMany({
            where: {
                userId: session.user.id,
                isDeleted: false,
                parentId: parentId || null
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
                        },
                        children: {
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
            count: folder._count.documents.length + folder._count.children.length,
            color: getRandomColor(folder.id), // Generate consistent color based on ID
            icon: folder.icon
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

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const { name, icon, parentId } = await request.json()

        if (!name || !name.trim()) {
            return NextResponse.json(
                { error: "Folder name is required" },
                { status: 400 }
            )
        }

        // Check if folder with same name already exists for this user
        const existingFolder = await prisma.folder.findFirst({
            where: {
                userId: session.user.id,
                name: name.trim(),
                isDeleted: false,
                parentId: parentId || null
            }
        })

        if (existingFolder) {
            return NextResponse.json(
                { error: "A folder with this name already exists" },
                { status: 409 }
            )
        }

        const newFolder = await prisma.folder.create({
            data: {
                name: name.trim(),
                icon: icon || 'folder',
                userId: session.user.id,
                parentId: parentId || null
            },
            select: {
                id: true,
                name: true,
                icon: true,
                createdAt: true,
                updatedAt: true
            }
        })

        return NextResponse.json(newFolder, { status: 201 })
    } catch (error) {
        console.error('Error creating folder:', error)
        return NextResponse.json(
            { error: 'Failed to create folder' },
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
