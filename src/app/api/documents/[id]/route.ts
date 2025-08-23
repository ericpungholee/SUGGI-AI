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
        const { title, content, plainText, wordCount, isStarred } = await request.json()

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

        // Update the document
        const updatedDocument = await prisma.document.update({
            where: {
                id: id
            },
            data: {
                ...(title && { title }),
                ...(content && { content }),
                ...(plainText !== undefined && { plainText }),
                ...(wordCount !== undefined && { wordCount }),
                ...(isStarred !== undefined && { isStarred }),
                updatedAt: new Date()
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
