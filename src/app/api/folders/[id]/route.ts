import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
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
        const { name, icon } = await request.json()

        if (!name || !name.trim()) {
            return NextResponse.json(
                { error: "Folder name is required" },
                { status: 400 }
            )
        }

        // Check if folder exists and belongs to user
        const existingFolder = await prisma.folder.findFirst({
            where: {
                id: id,
                userId: session.user.id,
                isDeleted: false
            }
        })

        if (!existingFolder) {
            return NextResponse.json(
                { error: "Folder not found" },
                { status: 404 }
            )
        }

        // Check if another folder with the same name already exists
        const duplicateFolder = await prisma.folder.findFirst({
            where: {
                userId: session.user.id,
                name: name.trim(),
                isDeleted: false,
                parentId: existingFolder.parentId,
                id: { not: id }
            }
        })

        if (duplicateFolder) {
            return NextResponse.json(
                { error: "A folder with this name already exists" },
                { status: 409 }
            )
        }

        // Update the folder
        const updatedFolder = await prisma.folder.update({
            where: { id: id },
            data: {
                name: name.trim(),
                icon: icon || existingFolder.icon,
                updatedAt: new Date()
            },
            select: {
                id: true,
                name: true,
                icon: true,
                updatedAt: true
            }
        })

        return NextResponse.json(updatedFolder)
    } catch (error) {
        console.error('Error updating folder:', error)
        return NextResponse.json(
            { error: 'Failed to update folder' },
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

        // Check if folder exists and belongs to user
        const existingFolder = await prisma.folder.findFirst({
            where: {
                id: id,
                userId: session.user.id,
                isDeleted: false
            },
            include: {
                documents: {
                    where: { isDeleted: false }
                },
                children: {
                    where: { isDeleted: false }
                }
            }
        })

        if (!existingFolder) {
            return NextResponse.json(
                { error: "Folder not found" },
                { status: 404 }
            )
        }

        // Soft delete the folder and all its contents
        await prisma.$transaction(async (tx) => {
            // Soft delete the folder
            await tx.folder.update({
                where: { id: id },
                data: {
                    isDeleted: true,
                    updatedAt: new Date()
                }
            })

            // Soft delete all documents in the folder
            if (existingFolder.documents.length > 0) {
                await tx.document.updateMany({
                    where: {
                        folderId: id,
                        isDeleted: false
                    },
                    data: {
                        isDeleted: true,
                        deletedAt: new Date()
                    }
                })
            }

            // Soft delete all child folders
            if (existingFolder.children.length > 0) {
                await tx.folder.updateMany({
                    where: {
                        parentId: id,
                        isDeleted: false
                    },
                    data: {
                        isDeleted: true,
                        updatedAt: new Date()
                    }
                })
            }
        })

        return NextResponse.json({ message: "Folder deleted successfully" })
    } catch (error) {
        console.error('Error deleting folder:', error)
        return NextResponse.json(
            { error: 'Failed to delete folder' },
            { status: 500 }
        )
    }
}
