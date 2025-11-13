/**
 * Patch Utilities
 * Functions for generating and applying unified diff patches
 */

import { diffLines, diffWords } from 'diff'

/**
 * Generate a unified diff patch from old and new content
 */
export function generatePatch(
  oldContent: string,
  newContent: string,
  filename: string = 'document.md'
): string {
  if (oldContent === newContent) {
    return ''
  }

  const diffs = diffLines(oldContent, newContent)

  let patch = `--- ${filename}\n+++ ${filename}\n`
  let oldLineNum = 1
  let newLineNum = 1
  let inHunk = false
  let hunkStartOld = 0
  let hunkStartNew = 0
  let hunkOldLines = 0
  let hunkNewLines = 0
  let hunkContent = ''

  for (const change of diffs) {
    const lines = change.value.split('\n')
    // Remove trailing empty line from split
    if (lines[lines.length - 1] === '') {
      lines.pop()
    }

    if (change.added) {
      if (!inHunk) {
        // Start new hunk
        inHunk = true
        hunkStartOld = oldLineNum
        hunkStartNew = newLineNum
        hunkOldLines = 0
        hunkNewLines = 0
        hunkContent = ''
      }
      // Add new lines
      for (const line of lines) {
        hunkContent += `+${line}\n`
        hunkNewLines++
      }
      newLineNum += lines.length
    } else if (change.removed) {
      if (!inHunk) {
        // Start new hunk
        inHunk = true
        hunkStartOld = oldLineNum
        hunkStartNew = newLineNum
        hunkOldLines = 0
        hunkNewLines = 0
        hunkContent = ''
      }
      // Remove old lines
      for (const line of lines) {
        hunkContent += `-${line}\n`
        hunkOldLines++
      }
      oldLineNum += lines.length
    } else {
      // Unchanged lines
      if (inHunk) {
        // Add context lines and close hunk
        const contextLines = Math.min(3, lines.length)
        for (let i = 0; i < contextLines; i++) {
          hunkContent += ` ${lines[i]}\n`
        }
        
        patch += `@@ -${hunkStartOld},${hunkOldLines} +${hunkStartNew},${hunkNewLines} @@\n`
        patch += hunkContent
        
        inHunk = false
        hunkContent = ''
      }
      oldLineNum += lines.length
      newLineNum += lines.length
    }
  }

  // Close any remaining hunk
  if (inHunk) {
    patch += `@@ -${hunkStartOld},${hunkOldLines} +${hunkStartNew},${hunkNewLines} @@\n`
    patch += hunkContent
  }

  return patch.trim()
}

/**
 * Generate a minimal patch for inline edits (word-level)
 */
export function generateInlinePatch(
  oldText: string,
  newText: string,
  filename: string = 'document.md'
): string {
  if (oldText === newText) {
    return ''
  }

  // For inline edits, use word-level diff
  const diffs = diffWords(oldText, newText)
  
  let patch = `--- ${filename}\n+++ ${filename}\n`
  patch += `@@ -1,1 +1,1 @@\n`
  
  let oldPart = ''
  let newPart = ''
  
  for (const change of diffs) {
    if (change.removed) {
      oldPart += change.value
    } else if (change.added) {
      newPart += change.value
    } else {
      // Unchanged text - add to both
      oldPart += change.value
      newPart += change.value
    }
  }
  
  if (oldPart !== newPart) {
    patch += `-${oldPart}\n`
    patch += `+${newPart}\n`
  }

  return patch.trim()
}

/**
 * Apply a unified diff patch to content
 */
export function applyPatch(content: string, patch: string): string {
  if (!patch || patch.trim() === '') {
    return content
  }

  const lines = content.split('\n')
  const patchLines = patch.split('\n')
  
  // Parse hunks
  const hunks: Array<{
    oldStart: number
    oldCount: number
    newStart: number
    newCount: number
    changes: Array<{ type: 'remove' | 'add' | 'context'; line: string }>
  }> = []

  let i = 0
  while (i < patchLines.length) {
    const line = patchLines[i]
    
    // Skip file headers
    if (line.startsWith('---') || line.startsWith('+++')) {
      i++
      continue
    }
    
    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/)
    if (hunkMatch) {
      const oldStart = parseInt(hunkMatch[1], 10)
      const oldCount = parseInt(hunkMatch[2] || '1', 10)
      const newStart = parseInt(hunkMatch[3], 10)
      const newCount = parseInt(hunkMatch[4] || '1', 10)
      
      const changes: Array<{ type: 'remove' | 'add' | 'context'; line: string }> = []
      i++
      
      // Parse hunk content
      while (i < patchLines.length && !patchLines[i].startsWith('@@')) {
        const changeLine = patchLines[i]
        if (changeLine.startsWith('-')) {
          changes.push({ type: 'remove', line: changeLine.substring(1) })
        } else if (changeLine.startsWith('+')) {
          changes.push({ type: 'add', line: changeLine.substring(1) })
        } else if (changeLine.startsWith(' ')) {
          changes.push({ type: 'context', line: changeLine.substring(1) })
        }
        i++
      }
      
      hunks.push({
        oldStart: oldStart - 1, // Convert to 0-based index
        oldCount,
        newStart: newStart - 1,
        newCount,
        changes
      })
    } else {
      i++
    }
  }

  // Apply hunks in reverse order to maintain line numbers
  hunks.reverse()
  
  for (const hunk of hunks) {
    const result: string[] = []
    let lineIndex = 0
    
    // Add lines before hunk
    while (lineIndex < hunk.oldStart && lineIndex < lines.length) {
      result.push(lines[lineIndex])
      lineIndex++
    }
    
    // Apply hunk changes
    for (const change of hunk.changes) {
      if (change.type === 'remove') {
        // Skip this line from original
        lineIndex++
      } else if (change.type === 'add') {
        // Add new line
        result.push(change.line)
      } else {
        // Context line - keep it
        if (lineIndex < lines.length) {
          result.push(lines[lineIndex])
          lineIndex++
        }
      }
    }
    
    // Skip remaining old lines in hunk
    let remainingOld = hunk.oldCount
    for (const change of hunk.changes) {
      if (change.type === 'remove' || change.type === 'context') {
        remainingOld--
      }
    }
    while (remainingOld > 0 && lineIndex < lines.length) {
      lineIndex++
      remainingOld--
    }
    
    // Add remaining lines after hunk
    while (lineIndex < lines.length) {
      result.push(lines[lineIndex])
      lineIndex++
    }
    
    lines.length = 0
    lines.push(...result)
  }

  return lines.join('\n')
}

/**
 * Convert HTML content to plain text for patch generation
 */
export function htmlToPlainText(html: string): string {
  // Remove HTML tags but preserve structure
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  
  // Normalize whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n')
  return text.trim()
}

/**
 * Convert plain text back to HTML (simple conversion)
 */
export function plainTextToHtml(text: string): string {
  return text
    .split('\n\n')
    .map(para => para.trim())
    .filter(para => para.length > 0)
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

