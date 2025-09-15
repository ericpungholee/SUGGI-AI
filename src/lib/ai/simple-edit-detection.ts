// Simple edit detection fallback for when LangGraph is not available
import { EditRequest, TextDiffHunk, EditProposal } from '@/types'

export interface SimpleEditResult {
  editRequest: EditRequest | null
  detectedIntent: string
  confidence: number
  editHunks: TextDiffHunk[]
  proposal: EditProposal | null
  processingStep: string
  error: string | null
}

export function detectEditRequest(message: string): {
  intent: string
  scope: 'selection' | 'document'
  guardrails: {
    allowCodeEdits: boolean
    allowMathEdits: boolean
    preserveVoice: boolean
  }
  confidence: number
} | null {
  const lowerMessage = message.toLowerCase()
  
  const editingKeywords = [
    'edit', 'improve', 'fix', 'change', 'revise', 'rewrite', 'enhance',
    'grammar', 'clarity', 'tone', 'structure', 'concise', 'expand',
    'tighten', 'professional', 'better', 'polish', 'refine', 'modify',
    'erase', 'clear', 'remove', 'delete', 'correct', 'adjust', 'update',
    'clean up', 'make better', 'improve the', 'fix the', 'change the',
    'write', 'add', 'insert', 'create', 'compose', 'draft', 'generate',
    'replace', 'substitute', 'swap', 'exchange', 'switch',
    'entire content', 'whole content', 'all content', 'full content',
    'into this document', 'to this document', 'in this document',
    'to the document', 'in the document', 'into the document'
  ]
  
  const isEditRequest = editingKeywords.some(keyword => lowerMessage.includes(keyword))
  
  if (!isEditRequest) return null
  
  // Extract intent
  let intent = 'improve writing'
  let confidence = 0.7
  
  if (lowerMessage.includes('replace') && 
      (lowerMessage.includes('entire') || lowerMessage.includes('whole') || 
       lowerMessage.includes('all') || lowerMessage.includes('full'))) {
    intent = 'replace entire content'
    confidence = 0.9
  } else if (lowerMessage.includes('replace')) {
    intent = 'replace content'
    confidence = 0.8
  } else if (lowerMessage.includes('grammar')) {
    intent = 'fix grammar and spelling'
    confidence = 0.9
  } else if (lowerMessage.includes('clarity')) {
    intent = 'improve clarity'
    confidence = 0.8
  } else if (lowerMessage.includes('tone')) {
    intent = 'enhance tone'
    confidence = 0.8
  } else if (lowerMessage.includes('structure')) {
    intent = 'improve structure'
    confidence = 0.8
  } else if (lowerMessage.includes('concise') || lowerMessage.includes('tighten')) {
    intent = 'make more concise'
    confidence = 0.8
  } else if (lowerMessage.includes('expand')) {
    intent = 'expand content'
    confidence = 0.8
  } else if (lowerMessage.includes('professional')) {
    intent = 'make tone professional'
    confidence = 0.8
  } else if (lowerMessage.includes('polish')) {
    intent = 'polish writing'
    confidence = 0.8
  } else if (lowerMessage.includes('write') || lowerMessage.includes('compose') || lowerMessage.includes('draft')) {
    intent = 'write new content'
    confidence = 0.8
  } else if (lowerMessage.includes('add') || lowerMessage.includes('insert')) {
    intent = 'add content'
    confidence = 0.8
  } else if (lowerMessage.includes('create') || lowerMessage.includes('generate')) {
    intent = 'create content'
    confidence = 0.8
  }
  
  // Determine scope
  const scope = lowerMessage.includes('selection') || lowerMessage.includes('selected') 
    ? 'selection' as const 
    : 'document' as const
  
  // Extract guardrails
  const guardrails = {
    allowCodeEdits: !lowerMessage.includes('no code') && !lowerMessage.includes('skip code'),
    allowMathEdits: !lowerMessage.includes('no math') && !lowerMessage.includes('skip math'),
    preserveVoice: !lowerMessage.includes('change voice') && !lowerMessage.includes('different tone')
  }
  
  return { intent, scope, guardrails, confidence }
}

export async function processSimpleEditRequest(
  userMessage: string,
  documentId: string,
  documentContent: string,
  conversationHistory: any[] = []
): Promise<SimpleEditResult> {
  try {
    // Detect edit request
    const editDetection = detectEditRequest(userMessage)
    
    if (!editDetection) {
      return {
        editRequest: null,
        detectedIntent: 'not_edit',
        confidence: 0,
        editHunks: [],
        proposal: null,
        processingStep: 'not_edit',
        error: null
      }
    }

    const editRequest: EditRequest = {
      documentId,
      scope: editDetection.scope,
      userIntent: editDetection.intent,
      guardrails: editDetection.guardrails
    }

    // Generate basic content based on the detected intent
    const isContentGeneration = editDetection.intent.includes('write') || 
                               editDetection.intent.includes('create') ||
                               editDetection.intent.includes('generate') ||
                               userMessage.toLowerCase().includes('essay')
    
    let generatedContent = ''
    if (isContentGeneration) {
      // Extract topic from user message
      const topic = userMessage.replace(/write|create|generate|essay|about/gi, '').trim()
      generatedContent = `# ${topic}

## Introduction
This document explores the topic of ${topic} in detail.

## Main Content
${topic} is a fascinating subject that deserves careful consideration. This section will delve into the key aspects and implications.

## Key Points
- Important aspect 1
- Important aspect 2  
- Important aspect 3

## Conclusion
In conclusion, ${topic} represents an important area of study that continues to evolve and impact our understanding.

---
*This content was generated based on your request: "${userMessage}"*`
    } else {
      // For editing requests, append to existing content
      generatedContent = documentContent + '\n\n[Generated content based on: ' + userMessage + ']'
    }
    
    const editHunks: TextDiffHunk[] = [
      {
        from: 0,
        to: documentContent.length,
        replacement: generatedContent,
        blockId: 'block_0',
        label: isContentGeneration ? 'Generate comprehensive content' : 'Apply user requested changes',
        changeType: 'content',
        sizeDelta: generatedContent.length - documentContent.length
      }
    ]

    const proposal: EditProposal = {
      id: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      originalContent: documentContent,
      patch: {
        proposalId: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        hunks: editHunks,
        summary: {
          blocksChanged: editHunks.length,
          wordsAdded: editHunks.reduce((sum, hunk) => sum + (hunk.sizeDelta > 0 ? hunk.sizeDelta : 0), 0),
          wordsRemoved: editHunks.reduce((sum, hunk) => sum + (hunk.sizeDelta < 0 ? Math.abs(hunk.sizeDelta) : 0), 0),
          totalChanges: editHunks.length
        }
      },
      status: 'ready',
      createdAt: new Date()
    }

    return {
      editRequest,
      detectedIntent: editDetection.intent,
      confidence: editDetection.confidence,
      editHunks,
      proposal,
      processingStep: 'simple_detection_complete',
      error: null
    }

  } catch (error) {
    return {
      editRequest: null,
      detectedIntent: '',
      confidence: 0,
      editHunks: [],
      proposal: null,
      processingStep: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
