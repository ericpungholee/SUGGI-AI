import { EditRequest, TextDiffHunk } from "@/types"

export interface EditPromptingConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  preserveVoice: boolean;
  allowCodeEdits: boolean;
  allowMathEdits: boolean;
}

export function buildEditSystemPrompt(
  content: string,
  context: string,
  config: EditPromptingConfig
): string {
  // Check if this is placeholder content that should be replaced entirely
  const isPlaceholderContent = content.includes('Start writing your document here') || 
                               content.includes('placeholder') ||
                               content.trim().length < 50

  if (isPlaceholderContent) {
    return `You are an expert content creator that generates complete, well-structured content. You must return your content as a JSON array of diff hunks that replace the placeholder text.

CRITICAL RULES:
1. Return ONLY valid JSON array of diff hunks, no other text
2. Replace the ENTIRE placeholder content with new, complete content
3. Create engaging, well-structured content that flows naturally
4. Use proper paragraphs and formatting
5. Make the content comprehensive and informative

DIFF HUNK FORMAT:
{
  "from": 0,                    // Start of placeholder content
  "to": ${content.length},      // End of placeholder content
  "replacement": "...",         // Complete new content
  "label": "Write complete content", // Human-readable description
  "changeType": "content"       // Always "content" for new content
}

GUARDRAILS:
- Allow code edits: ${config.allowCodeEdits}
- Allow math edits: ${config.allowMathEdits}
- Preserve voice: ${config.preserveVoice}

PLACEHOLDER CONTENT TO REPLACE:
${content}

${context ? `\nCONTEXT:\n${context}` : ''}

Generate complete, engaging content that replaces the placeholder entirely.`
  }

  return `You are an expert text editor that generates precise, surgical edits to improve writing quality. You must return your edits as a JSON array of diff hunks.

CRITICAL RULES:
1. Return ONLY valid JSON array of diff hunks, no other text
2. Each hunk must have: from, to, replacement, label, changeType
3. Preserve the author's voice and style
4. Make small, focused changes
5. Group related changes into single hunks when possible

DIFF HUNK FORMAT:
{
  "from": 0,           // Start character position
  "to": 10,            // End character position  
  "replacement": "...", // New text
  "label": "Fix grammar", // Human-readable description
  "changeType": "grammar" // grammar|clarity|tone|structure|content
}

GUARDRAILS:
- Allow code edits: ${config.allowCodeEdits}
- Allow math edits: ${config.allowMathEdits}
- Preserve voice: ${config.preserveVoice}

CONTENT TO EDIT:
${content}

${context ? `\nCONTEXT:\n${context}` : ''}

Generate 3-6 focused, high-impact edits that improve the writing while respecting the guardrails.`
}

export function buildEditUserPrompt(intent: string, scope: string): string {
  // Check if this is a content creation request
  const isContentCreation = intent.includes('write') || 
                           intent.includes('create') || 
                           intent.includes('generate') ||
                           intent.includes('essay') ||
                           intent.includes('article')

  if (isContentCreation) {
    return `Please ${intent} for this ${scope}. Create comprehensive, well-structured content that is engaging and informative. Use proper paragraphs, clear headings if appropriate, and ensure the content flows naturally from start to finish.`
  }

  return `Please ${intent} this ${scope}. Focus on making the text clearer, more engaging, and better structured while maintaining the original meaning and voice.`
}

export function parseEditResponse(response: string): TextDiffHunk[] {
  try {
    // Try to parse the response as JSON
    const hunks = JSON.parse(response)
    
    if (!Array.isArray(hunks)) {
      throw new Error('Response is not an array')
    }

    return hunks.map((hunk, index) => ({
      from: hunk.from || 0,
      to: hunk.to || 0,
      replacement: hunk.replacement || '',
      blockId: `block_${index}`,
      label: hunk.label || 'Edit',
      changeType: hunk.changeType || 'content',
      sizeDelta: (hunk.replacement || '').length - ((hunk.to || 0) - (hunk.from || 0))
    }))
  } catch (error) {
    console.error('Error parsing edit response:', error)
    return []
  }
}

export function validateEditHunk(hunk: TextDiffHunk): boolean {
  return (
    typeof hunk.from === 'number' &&
    typeof hunk.to === 'number' &&
    typeof hunk.replacement === 'string' &&
    hunk.from >= 0 &&
    hunk.to >= hunk.from &&
    hunk.label.length > 0 &&
    ['grammar', 'clarity', 'tone', 'structure', 'content'].includes(hunk.changeType)
  )
}

export function generateEditSummary(hunks: TextDiffHunk[]): {
  blocksChanged: number;
  wordsAdded: number;
  wordsRemoved: number;
  totalChanges: number;
} {
  const wordsAdded = hunks.reduce((sum, hunk) => sum + (hunk.sizeDelta > 0 ? hunk.sizeDelta : 0), 0)
  const wordsRemoved = hunks.reduce((sum, hunk) => sum + (hunk.sizeDelta < 0 ? Math.abs(hunk.sizeDelta) : 0), 0)

  return {
    blocksChanged: hunks.length,
    wordsAdded,
    wordsRemoved,
    totalChanges: hunks.length
  }
}

export function detectEditConflicts(
  originalContent: string,
  hunks: TextDiffHunk[],
  currentContent: string
): string[] {
  const conflicts: string[] = []
  
  // Simple conflict detection - if content has changed significantly
  if (originalContent !== currentContent) {
    // Check if any hunks overlap with changed regions
    for (const hunk of hunks) {
      const originalText = originalContent.substring(hunk.from, hunk.to)
      const currentText = currentContent.substring(hunk.from, hunk.to)
      
      if (originalText !== currentText) {
        conflicts.push(hunk.blockId)
      }
    }
  }
  
  return conflicts
}
