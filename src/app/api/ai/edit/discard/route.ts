import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Use database for proposal storage

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { proposalId, action } = body

    if (!proposalId) {
      return NextResponse.json(
        { error: "Proposal ID is required" },
        { status: 400 }
      )
    }

    // Get the proposal from database
    const proposal = await prisma.editProposal.findUnique({
      where: { id: proposalId }
    })
    
    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      )
    }

    if (action === 'discard') {
      // Mark proposal as discarded
      await prisma.editProposal.update({
        where: { id: proposalId },
        data: { status: 'discarded' }
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'Proposal discarded' 
      })
    }

    if (action === 'undo') {
      // For undo, we would need to restore the original content
      // This is a simplified implementation
      await prisma.editProposal.update({
        where: { id: proposalId },
        data: { status: 'discarded' }
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'Changes undone',
        originalContent: proposal.originalContent
      })
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'discard' or 'undo'" },
      { status: 400 }
    )

  } catch (error) {
    console.error('Discard/undo API error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}