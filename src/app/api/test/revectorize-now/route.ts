import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createEmbedding } from '@/lib/ai/embeddings'
import { storeDocumentInVectorDB } from '@/lib/ai/vector-db'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting re-vectorization process...')
    
    // Get all documents for the user
    const documents = await prisma.document.findMany({
      where: {
        userId: 'cmf7al4430000bj24i5yyx724',
        isDeleted: false
      },
      select: {
        id: true,
        title: true,
        plainText: true,
        content: true
      }
    })
    
    console.log(`📄 Found ${documents.length} documents to re-vectorize`)
    
    let processed = 0
    let errors = 0
    
    for (const doc of documents) {
      try {
        console.log(`\n🔄 Processing: ${doc.title}`)
        
        // Extract content
        let content = doc.plainText
        if (!content && doc.content) {
          if (typeof doc.content === 'string') {
            content = doc.content
          } else if (doc.content.plainText) {
            content = doc.content.plainText
          }
        }
        
        if (!content) {
          console.log(`❌ No content found for document: ${doc.title}`)
          errors++
          continue
        }
        
        console.log(`📝 Content length: ${content.length} characters`)
        
        // Delete old chunks
        const deletedChunks = await prisma.documentChunk.deleteMany({
          where: {
            documentId: doc.id
          }
        })
        console.log(`🗑️  Deleted ${deletedChunks.count} old chunks`)
        
        // Re-vectorize the document
        await storeDocumentInVectorDB(doc.id, doc.title, content, 'cmf7al4430000bj24i5yyx724')
        console.log(`✅ Successfully re-vectorized: ${doc.title}`)
        processed++
        
      } catch (error) {
        console.error(`❌ Failed to re-vectorize ${doc.title}:`, error)
        errors++
      }
    }
    
    // Verify the results
    const totalChunks = await prisma.documentChunk.count({
      where: {
        document: {
          userId: 'cmf7al4430000bj24i5yyx724'
        }
      }
    })
    
    console.log(`\n🎉 Re-vectorization completed!`)
    console.log(`📊 Processed: ${processed} documents`)
    console.log(`❌ Errors: ${errors} documents`)
    console.log(`📊 Total chunks in database: ${totalChunks}`)
    
    return NextResponse.json({
      success: true,
      message: 'Re-vectorization completed',
      processed,
      errors,
      totalChunks
    })
    
  } catch (error) {
    console.error('💥 Error during re-vectorization:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Re-vectorization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
