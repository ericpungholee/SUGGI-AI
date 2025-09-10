import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export interface DocumentChange {
  type: 'added' | 'modified' | 'deleted'
  startIndex: number
  endIndex: number
  oldContent?: string
  newContent?: string
  chunkId?: string
}

export interface DocumentVersion {
  id: string
  documentId: string
  contentHash: string
  contentLength: number
  vectorizedAt: Date
  chunksCount: number
}

/**
 * Generate a content hash for change detection
 */
export function generateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Track document changes by comparing content versions
 */
export async function trackDocumentChanges(
  documentId: string, 
  newContent: string
): Promise<DocumentChange[]> {
  try {
    // Get the latest version
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' }
    })

    const newHash = generateContentHash(newContent)
    
    // If no previous version or content hasn't changed, return empty
    if (!latestVersion || latestVersion.contentHash === newHash) {
      return []
    }

    // Get the previous content
    const previousVersion = await prisma.documentVersion.findFirst({
      where: { 
        documentId,
        id: { not: latestVersion.id }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!previousVersion) {
      // First time vectorizing - everything is new
      return [{
        type: 'added',
        startIndex: 0,
        endIndex: newContent.length,
        newContent
      }]
    }

    // Get previous content from chunks
    const previousChunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' }
    })

    const previousContent = previousChunks
      .map(chunk => chunk.content)
      .join('')

    // Use diff algorithm to find changes
    const changes = computeContentDiff(previousContent, newContent)
    
    return changes
  } catch (error) {
    console.error('Error tracking document changes:', error)
    return []
  }
}

/**
 * Simple diff algorithm to find content changes
 */
function computeContentDiff(oldContent: string, newContent: string): DocumentChange[] {
  const changes: DocumentChange[] = []
  
  // If content is completely different, treat as full replacement
  if (oldContent.length === 0 || newContent.length === 0) {
    if (newContent.length > 0) {
      changes.push({
        type: 'added',
        startIndex: 0,
        endIndex: newContent.length,
        newContent
      })
    }
    return changes
  }

  // Find common prefix and suffix
  let commonPrefix = 0
  let commonSuffix = 0
  
  // Find common prefix
  while (
    commonPrefix < oldContent.length && 
    commonPrefix < newContent.length && 
    oldContent[commonPrefix] === newContent[commonPrefix]
  ) {
    commonPrefix++
  }
  
  // Find common suffix
  while (
    commonSuffix < oldContent.length - commonPrefix && 
    commonSuffix < newContent.length - commonPrefix && 
    oldContent[oldContent.length - 1 - commonSuffix] === newContent[newContent.length - 1 - commonSuffix]
  ) {
    commonSuffix++
  }

  // If there are changes in the middle
  if (commonPrefix + commonSuffix < Math.min(oldContent.length, newContent.length)) {
    const oldMiddle = oldContent.substring(commonPrefix, oldContent.length - commonSuffix)
    const newMiddle = newContent.substring(commonPrefix, newContent.length - commonSuffix)
    
    if (oldMiddle.length > 0) {
      changes.push({
        type: 'deleted',
        startIndex: commonPrefix,
        endIndex: commonPrefix + oldMiddle.length,
        oldContent: oldMiddle
      })
    }
    
    if (newMiddle.length > 0) {
      changes.push({
        type: 'added',
        startIndex: commonPrefix,
        endIndex: commonPrefix + newMiddle.length,
        newContent: newMiddle
      })
    }
  } else if (newContent.length > oldContent.length) {
    // Content was appended
    changes.push({
      type: 'added',
      startIndex: oldContent.length,
      endIndex: newContent.length,
      newContent: newContent.substring(oldContent.length)
    })
  } else if (newContent.length < oldContent.length) {
    // Content was truncated
    changes.push({
      type: 'deleted',
      startIndex: newContent.length,
      endIndex: oldContent.length,
      oldContent: oldContent.substring(newContent.length)
    })
  }

  return changes
}

/**
 * Save document version for change tracking
 */
export async function saveDocumentVersion(
  documentId: string,
  content: string,
  chunksCount: number
): Promise<DocumentVersion> {
  const contentHash = generateContentHash(content)
  
  const version = await prisma.documentVersion.create({
    data: {
      documentId,
      contentHash,
      contentLength: content.length,
      chunksCount,
      vectorizedAt: new Date()
    }
  })

  return version
}

/**
 * Get document version history
 */
export async function getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  return await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { createdAt: 'desc' }
  })
}

/**
 * Check if document needs re-vectorization
 */
export async function needsRevectorization(documentId: string, content: string): Promise<boolean> {
  try {
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' }
    })

    if (!latestVersion) {
      return true // Never vectorized
    }

    const currentHash = generateContentHash(content)
    return latestVersion.contentHash !== currentHash
  } catch (error) {
    console.error('Error checking re-vectorization need:', error)
    return true // Default to re-vectorize on error
  }
}
