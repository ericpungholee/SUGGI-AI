import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const documentId = 'cmfb894u10003bjx8gj3nqjtg'

    // Get document info
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: session.user.id,
        isDeleted: false
      },
      select: {
        id: true,
        title: true,
        plainText: true,
        isVectorized: true,
        wordCount: true,
        updatedAt: true
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check content
    const content = document.plainText || ''
    const hasNeuroCore = content.includes('NeuroCore X1')
    const hasRTXOrion = content.includes('RTX Orion 5090')
    const hasQuantumVision = content.includes('Quantum Vision Engine')

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        isVectorized: document.isVectorized,
        wordCount: document.wordCount,
        contentLength: content.length,
        lastUpdated: document.updatedAt
      },
      contentCheck: {
        hasNeuroCore,
        hasRTXOrion,
        hasQuantumVision,
        contentPreview: content.substring(0, 200) + '...'
      }
    })
  } catch (error) {
    console.error('Error in simple diagnostic:', error)
    return NextResponse.json(
      { 
        error: 'Simple diagnostic failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}
