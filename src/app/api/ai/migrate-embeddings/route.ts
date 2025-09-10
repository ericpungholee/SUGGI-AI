import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createEmbedding } from '@/lib/ai/embeddings'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { force = false } = await request.json()

    console.log('Starting embedding migration...')

    // Get all document chunks with old 1536-dimension embeddings
    const oldChunks = await prisma.documentChunk.findMany({
      where: {
        document: {
          userId: session.user.id,
          isDeleted: false
        }
      },
      include: {
        document: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })

    console.log(`Found ${oldChunks.length} chunks to migrate`)

    if (oldChunks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No chunks need migration',
        migrated: 0
      })
    }

    let migrated = 0
    let errors = 0

    // Process chunks in batches to avoid overwhelming the API
    const batchSize = 5
    for (let i = 0; i < oldChunks.length; i += batchSize) {
      const batch = oldChunks.slice(i, i + batchSize)
      
      await Promise.all(batch.map(async (chunk) => {
        try {
          // Check if chunk has old 1536-dimension embedding
          const embedding = chunk.embedding as number[]
          if (embedding.length !== 1536) {
            console.log(`Skipping chunk ${chunk.id} - already has ${embedding.length} dimensions`)
            return
          }

          console.log(`Migrating chunk ${chunk.id} from document "${chunk.document.title}"`)

          // Generate new 3072-dimension embedding
          const newEmbedding = await createEmbedding(chunk.content)

          // Update the chunk with new embedding
          await prisma.documentChunk.update({
            where: { id: chunk.id },
            data: {
              embedding: newEmbedding.embedding
            }
          })

          migrated++
          console.log(`✓ Migrated chunk ${chunk.id}`)
        } catch (error) {
          errors++
          console.error(`✗ Failed to migrate chunk ${chunk.id}:`, error)
        }
      }))

      // Small delay between batches to be respectful to the API
      if (i + batchSize < oldChunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`Migration completed: ${migrated} migrated, ${errors} errors`)

    return NextResponse.json({
      success: true,
      message: `Migration completed: ${migrated} chunks migrated, ${errors} errors`,
      migrated,
      errors,
      total: oldChunks.length
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}