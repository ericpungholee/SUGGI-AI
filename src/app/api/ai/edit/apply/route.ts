import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApplyEditRequest, ApplyEditResult } from "@/types"

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
    const { proposalId, blockIds }: ApplyEditRequest = body

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
      console.error('Proposal not found:', proposalId)
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      )
    }

    // Parse the patch from JSON string
    const patch = JSON.parse(proposal.patch)

    // Get the document
    const document = await prisma.document.findFirst({
      where: {
        id: proposal.documentId,
        userId: session.user.id
      }
    })

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Apply the edits
    let newContent = proposal.originalContent
    const blocksApplied: string[] = []
    let wordsAdded = 0
    let wordsRemoved = 0
    const summary: string[] = []

    // Filter hunks to apply (if blockIds specified, only apply those blocks)
    const hunksToApply = blockIds && blockIds.length > 0
      ? patch.hunks.filter((hunk: any) => blockIds.includes(hunk.blockId))
      : patch.hunks

    // Sort hunks by position (reverse order to avoid position shifts)
    const sortedHunks = hunksToApply.sort((a, b) => b.from - a.from)

    for (const hunk of sortedHunks) {
      // Apply the edit
      const beforeText = newContent.substring(0, hunk.from)
      const afterText = newContent.substring(hunk.to)
      newContent = beforeText + hunk.replacement + afterText

      // Track changes
      blocksApplied.push(hunk.blockId)
      wordsAdded += hunk.sizeDelta > 0 ? hunk.sizeDelta : 0
      wordsRemoved += hunk.sizeDelta < 0 ? Math.abs(hunk.sizeDelta) : 0
      summary.push(hunk.label)

      // Update positions for remaining hunks
      const positionShift = hunk.replacement.length - (hunk.to - hunk.from)
      for (const otherHunk of sortedHunks) {
        if (otherHunk.from > hunk.from) {
          otherHunk.from += positionShift
          otherHunk.to += positionShift
        }
      }
    }

    // Update the document in the database
    const plainText = newContent.replace(/<[^>]*>/g, '')
    const wordCount = plainText.split(/\s+/).filter(Boolean).length
    
    console.log('Updating document with new content:', {
      documentId: document.id,
      newContentLength: newContent.length,
      plainTextLength: plainText.length,
      wordCount: wordCount
    })
    
    await prisma.document.update({
      where: { id: document.id },
      data: {
        content: {
          html: newContent,
          plainText: plainText,
          wordCount: wordCount
        },
        plainText: plainText,
        wordCount: wordCount,
        updatedAt: new Date()
      }
    })
    
    console.log('Document updated successfully')

    // Update proposal status in database
    await prisma.editProposal.update({
      where: { id: proposalId },
      data: {
        status: 'applied',
        appliedAt: new Date()
      }
    })

    const result: ApplyEditResult = {
      proposalId,
      blocksApplied,
      wordsAdded,
      wordsRemoved,
      summary,
      newContent
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Apply edit API error:', error)
    return NextResponse.json(
      { error: 'Failed to apply edits' },
      { status: 500 }
    )
  }
}