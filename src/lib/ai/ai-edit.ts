import { generateChatCompletion, ChatMessage } from './openai'

export interface AIEditRequest {
    content: string
    selection?: string | null
    intent?: string
    userId: string
    documentId?: string | null
    operationId?: string | null
}

export interface AIEditResponse {
    success: boolean
    originalContent: string
    editedContent: string
    patches: EditPatch[]
    noChanges?: boolean
    error?: string
    cancelled?: boolean
}

export interface EditPatch {
    type: 'insert' | 'delete' | 'replace'
    originalText: string
    newText: string
    position: number
    length: number
    blockId: string
    reason: string
}

export interface EditBlock {
    id: string
    type: 'paragraph' | 'heading' | 'list' | 'blockquote' | 'code'
    originalContent: string
    editedContent: string
    patches: EditPatch[]
    hasChanges: boolean
    accepted?: boolean
    rejected?: boolean
}

/**
 * Process AI edit request for document content
 */
export async function processAIEdit(request: AIEditRequest): Promise<AIEditResponse> {
    try {
        const { content, selection, intent, userId, documentId } = request

        // Determine what content to edit
        const contentToEdit = selection || content
        
        // Check if content is too large (warn if > 5000 characters)
        if (contentToEdit.length > 5000) {
            console.warn(`Large document edit requested: ${contentToEdit.length} characters`)
        }

        // Check for immutable regions and warn if found
        const immutableRegions = detectImmutableRegions(contentToEdit)
        if (immutableRegions.length > 0) {
            console.log(`Found ${immutableRegions.length} immutable regions in content`)
        }

        // Build system prompt for AI editing
        const systemPrompt = buildEditSystemPrompt(intent, contentToEdit.length, immutableRegions)
        
        // Build user prompt
        const userPrompt = buildEditUserPrompt(contentToEdit, intent, selection ? 'selection' : 'document')

        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userPrompt
            }
        ]

        // Generate AI response
        const response = await generateChatCompletion(messages, {
            model: process.env.OPENAI_CHAT_MODEL || 'gpt-4',
            temperature: 0.3, // Lower temperature for more consistent editing
            max_tokens: 4000,
            useWebSearch: false
        })

        const aiResponse = response.choices[0]?.message?.content || ''
        console.log('Raw AI Edit Response:', aiResponse)
        
        // Parse AI response to extract edited content and patches
        const parsedResponse = parseAIEditResponse(aiResponse, contentToEdit, content)
        
        return parsedResponse
    } catch (error) {
        console.error('AI edit processing failed:', error)
        throw error
    }
}

/**
 * Detect immutable regions in content (code blocks, math, etc.)
 */
function detectImmutableRegions(content: string): Array<{ type: string, start: number, end: number }> {
    const regions: Array<{ type: string, start: number, end: number }> = []
    
    // Detect code blocks (```code```)
    const codeBlockRegex = /```[\s\S]*?```/g
    let match
    while ((match = codeBlockRegex.exec(content)) !== null) {
        regions.push({
            type: 'code-block',
            start: match.index,
            end: match.index + match[0].length
        })
    }
    
    // Detect inline code (`code`)
    const inlineCodeRegex = /`[^`]+`/g
    while ((match = inlineCodeRegex.exec(content)) !== null) {
        regions.push({
            type: 'inline-code',
            start: match.index,
            end: match.index + match[0].length
        })
    }
    
    // Detect math expressions ($math$)
    const mathRegex = /\$[^$]+\$/g
    while ((match = mathRegex.exec(content)) !== null) {
        regions.push({
            type: 'math',
            start: match.index,
            end: match.index + match[0].length
        })
    }
    
    return regions
}

/**
 * Build system prompt for AI editing
 */
function buildEditSystemPrompt(intent: string, contentLength: number, immutableRegions: Array<{ type: string, start: number, end: number }> = []): string {
    const basePrompt = `You are a precise writing editor. Your task is to improve the given document (or selection) based on the user's intent.

CRITICAL RULES:
1. Return ONLY a JSON object with this exact structure:
{
  "editedContent": "the improved text",
  "patches": [
    {
      "type": "replace|insert|delete",
      "originalText": "text that was changed",
      "newText": "new text (empty for deletions)",
      "position": 0,
      "length": 5,
      "blockId": "block_1",
      "reason": "brief explanation of the change"
    }
  ],
  "summary": "brief summary of changes made"
}

2. Preserve the author's voice and document structure
3. Do NOT add unverifiable facts
4. NEVER modify content inside code blocks (triple backticks), inline code (single backticks), or math expressions ($math$)
5. Make minimal, precise changes that improve clarity, grammar, tone, and structure
6. If no changes are needed, return: {"noChanges": true, "summary": "No changes suggested."}
7. Each patch should be atomic and focused on a specific improvement
8. Use blockId to group related changes (e.g., "block_1", "block_2")
9. Keep reasons concise but descriptive
10. IMMUTABLE REGIONS: Do not edit any content that appears to be code, math, or technical specifications
11. BE DIRECT: Make improvements immediately without asking for clarification or preferences
12. ASSUME REASONABLE DEFAULTS: Apply your best judgment for improvements without requesting additional input`

    const intentSpecific = getIntentSpecificInstructions(intent)
    const lengthGuidance = contentLength > 5000 
        ? "\n\nNOTE: This is a large document. Focus on the most impactful improvements."
        : ""
    
    const immutableGuidance = immutableRegions.length > 0 
        ? `\n\nPROTECTED REGIONS: The content contains ${immutableRegions.length} protected regions (code blocks, inline code, or math expressions). DO NOT modify these regions.`
        : ""

    return basePrompt + intentSpecific + lengthGuidance + immutableGuidance
}

/**
 * Get intent-specific editing instructions
 */
function getIntentSpecificInstructions(intent: string): string {
    const intentMap: { [key: string]: string } = {
        'improve writing': '\n\nFocus on: clarity, flow, conciseness, and readability improvements.',
        'fix grammar': '\n\nFocus on: grammar, spelling, punctuation, and syntax corrections.',
        'enhance tone': '\n\nFocus on: adjusting tone to be more professional, casual, or engaging as appropriate.',
        'improve structure': '\n\nFocus on: paragraph organization, logical flow, and structural improvements.',
        'simplify': '\n\nFocus on: making complex sentences simpler and more accessible.',
        'expand': '\n\nFocus on: adding relevant details and examples to enrich the content.',
        'summarize': '\n\nFocus on: condensing content while preserving key information.',
        'make concise': '\n\nFocus on: removing redundancy and tightening language.',
        'default': '\n\nFocus on: overall writing quality improvements.'
    }

    return intentMap[intent] || intentMap['default']
}

/**
 * Build user prompt for AI editing
 */
function buildEditUserPrompt(content: string, intent: string, scope: string): string {
    return `Please edit the following ${scope} to "${intent}":

---
${content}
---

Return the improved version as a JSON object with the exact structure specified in the system prompt.`
}

/**
 * Parse AI response to extract edited content and patches
 */
function parseAIEditResponse(aiResponse: string, originalContent: string, fullContent: string): AIEditResponse {
    try {
        console.log('Parsing AI response:', aiResponse)
        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            console.error('No JSON found in AI response')
            throw new Error('No JSON found in AI response')
        }

        console.log('Found JSON match:', jsonMatch[0])
        const parsed = JSON.parse(jsonMatch[0])
        console.log('Parsed JSON:', parsed)
        
        // Check for no changes response
        if (parsed.noChanges) {
            return {
                success: true,
                originalContent: fullContent,
                editedContent: fullContent,
                patches: [],
                noChanges: true
            }
        }

        // Validate required fields
        if (!parsed.editedContent || !parsed.patches) {
            throw new Error('Missing required fields in AI response')
        }

        // Process patches and create blocks
        const processedPatches = parsed.patches.map((patch: any, index: number) => ({
            type: patch.type || 'replace',
            originalText: patch.originalText || '',
            newText: patch.newText || '',
            position: patch.position || 0,
            length: patch.length || 0,
            blockId: patch.blockId || `block_${index + 1}`,
            reason: patch.reason || 'Improvement made'
        }))

        // Determine final edited content
        const editedContent = parsed.editedContent

        return {
            success: true,
            originalContent: fullContent,
            editedContent: editedContent,
            patches: processedPatches,
            noChanges: false
        }
    } catch (error) {
        console.error('Failed to parse AI edit response:', error)
        
        // Fallback: return the original content with no changes
        return {
            success: false,
            originalContent: fullContent,
            editedContent: fullContent,
            patches: [],
            error: 'Failed to parse AI response'
        }
    }
}

/**
 * Group patches by block ID
 */
export function groupPatchesByBlock(patches: EditPatch[]): { [blockId: string]: EditPatch[] } {
    const grouped: { [blockId: string]: EditPatch[] } = {}
    
    patches.forEach(patch => {
        if (!grouped[patch.blockId]) {
            grouped[patch.blockId] = []
        }
        grouped[patch.blockId].push(patch)
    })
    
    return grouped
}

/**
 * Create edit blocks from patches
 */
export function createEditBlocks(patches: EditPatch[]): EditBlock[] {
    const grouped = groupPatchesByBlock(patches)
    const blocks: EditBlock[] = []
    
    Object.entries(grouped).forEach(([blockId, blockPatches]) => {
        // Determine block type based on content or patches
        const blockType = determineBlockType(blockPatches)
        
        // Calculate original and edited content for this block
        const { originalContent, editedContent } = calculateBlockContent(blockPatches)
        
        blocks.push({
            id: blockId,
            type: blockType,
            originalContent,
            editedContent,
            patches: blockPatches,
            hasChanges: blockPatches.length > 0
        })
    })
    
    return blocks
}

/**
 * Determine block type from patches
 */
function determineBlockType(patches: EditPatch[]): EditBlock['type'] {
    // Simple heuristic - could be enhanced with more sophisticated detection
    const content = patches[0]?.originalText || patches[0]?.newText || ''
    
    if (content.includes('```') || content.includes('`')) {
        return 'code'
    } else if (content.startsWith('>')) {
        return 'blockquote'
    } else if (content.startsWith('#') || content.startsWith('##') || content.startsWith('###')) {
        return 'heading'
    } else if (content.startsWith('-') || content.startsWith('*') || /^\d+\./.test(content)) {
        return 'list'
    } else {
        return 'paragraph'
    }
}

/**
 * Calculate block content from patches
 */
function calculateBlockContent(patches: EditPatch[]): { originalContent: string; editedContent: string } {
    // This is a simplified implementation
    // In a real implementation, you'd want to properly reconstruct the content
    let originalContent = ''
    let editedContent = ''
    
    patches.forEach(patch => {
        originalContent += patch.originalText
        editedContent += patch.newText
    })
    
    return { originalContent, editedContent }
}
