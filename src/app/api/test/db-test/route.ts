import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
    try {
        console.log('Testing database connection...')
        
        // Test basic database connection
        const userCount = await prisma.user.count()
        console.log('User count:', userCount)
        
        return NextResponse.json({
            success: true,
            message: 'Database connection successful',
            userCount
        })
    } catch (error) {
        console.error('Database test error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Database test failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
