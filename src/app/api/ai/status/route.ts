import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkAIStatus, getAIStatusMessage } from "@/lib/ai/ai-status"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const status = await checkAIStatus()
    const message = getAIStatusMessage(status)

    return NextResponse.json({
      status,
      message,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('AI status check error:', error)
    return NextResponse.json(
      { 
        error: "Failed to check AI status",
        fallbackAvailable: true 
      },
      { status: 500 }
    )
  }
}
