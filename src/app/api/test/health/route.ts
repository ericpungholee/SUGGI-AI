import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    // Test basic functionality
    const session = await getServerSession(authOptions)
    
    return NextResponse.json({
      success: true,
      message: "API is working",
      timestamp: new Date().toISOString(),
      session: session ? "authenticated" : "not authenticated",
      environment: {
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasPineconeKey: !!process.env.PINECONE_API_KEY
      }
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
