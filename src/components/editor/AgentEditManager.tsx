'use client'
import React, { useRef, useCallback } from 'react'

interface AgentEditManagerProps {
  editorRef: React.RefObject<HTMLDivElement | null>
  onContentChange?: (content: string) => void
}

interface PendingEdit {
  id: string
  element: HTMLElement
  originalHTML: string
}

export class AgentEditManager {
  private editorRef: React.RefObject<HTMLDivElement | null>
  private onContentChange?: (content: string) => void
  private pendingEdits = new Map<string, PendingEdit>()

  constructor(
    editorRef: React.RefObject<HTMLDivElement | null>,
    onContentChange?: (content: string) => void
  ) {
    this.editorRef = editorRef
    this.onContentChange = onContentChange
  }

  /**
   * Apply agent content to the editor with gray styling (pending approval)
   */
  applyEdit(content: string, cursorPosition?: string): string {
    if (!this.editorRef.current) {
      console.error('Editor ref not available')
      return ''
    }

    const editor = this.editorRef.current
    const selection = window.getSelection()
    const editId = `agent-edit-${Date.now()}`

    // Parse content as HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = content

    // Create a wrapper span for the edit with pending styling
    const editWrapper = document.createElement('span')
    editWrapper.className = 'agent-text-block'
    editWrapper.setAttribute('data-is-approved', 'false')
    editWrapper.setAttribute('data-edit-id', editId)
    editWrapper.style.cssText = `
      color: #6b7280 !important;
      background: rgba(107, 114, 128, 0.08) !important;
      border-bottom: 1px solid #d1d5db !important;
      padding: 2px 0 !important;
      border-radius: 2px !important;
      transition: all 0.3s ease !important;
      display: inline !important;
    `

    // Move all content from tempDiv to editWrapper
    while (tempDiv.firstChild) {
      editWrapper.appendChild(tempDiv.firstChild)
    }

    // Determine insertion point based on cursor position
    let insertRange: Range | null = null

    if (cursorPosition === 'selection' && selection && selection.rangeCount > 0) {
      // Replace selection
      insertRange = selection.getRangeAt(0)
    } else if (cursorPosition === 'beginning') {
      // Insert at beginning
      insertRange = document.createRange()
      insertRange.selectNodeContents(editor)
      insertRange.collapse(true)
    } else {
      // Insert at cursor or end
      if (selection && selection.rangeCount > 0) {
        insertRange = selection.getRangeAt(0)
        insertRange.collapse(false) // Collapse to end
      } else {
        // Fallback to end of document
        insertRange = document.createRange()
        insertRange.selectNodeContents(editor)
        insertRange.collapse(false)
      }
    }

    // Handle selection replacement
    if (cursorPosition === 'selection' && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(editWrapper)
      
      // Position cursor after inserted content
      const newRange = document.createRange()
      newRange.setStartAfter(editWrapper)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
    } else {
      // Insert at position
      insertRange.insertNode(editWrapper)
      
      // Position cursor after inserted content
      const newRange = document.createRange()
      newRange.setStartAfter(editWrapper)
      newRange.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(newRange)
    }

    // Store the pending edit
    this.pendingEdits.set(editId, {
      id: editId,
      element: editWrapper,
      originalHTML: editWrapper.innerHTML
    })

    // Focus the editor
    editor.focus()

    console.log('✅ Agent edit applied:', {
      editId,
      contentLength: content.length,
      cursorPosition
    })

    return editId
  }

  /**
   * Approve a pending edit - turns gray text to black and saves
   */
  approveEdit(editId: string): boolean {
    if (!this.editorRef.current) {
      console.error('Editor ref not available for approval')
      return false
    }

    const edit = this.pendingEdits.get(editId)
    if (!edit) {
      // Try to find by element if ID not found
      const allPending = this.editorRef.current.querySelectorAll(
        '.agent-text-block[data-is-approved="false"]'
      )
      if (allPending && allPending.length > 0) {
        const firstPending = allPending[0] as HTMLElement
        const foundEditId = firstPending.getAttribute('data-edit-id')
        firstPending.setAttribute('data-is-approved', 'true')
        firstPending.removeAttribute('data-edit-id')
        firstPending.style.cssText = `
          color: #000000 !important;
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          transition: all 0.3s ease !important;
        `
        
        // Save content
        if (this.onContentChange) {
          this.onContentChange(this.editorRef.current.innerHTML)
        }
        
        // Clean up
        if (foundEditId) {
          this.pendingEdits.delete(foundEditId)
        }
        console.log('✅ Approved edit (found by element)')
        return true
      }
      return false
    }

    // Update styling to approved (black text, no background)
    edit.element.setAttribute('data-is-approved', 'true')
    edit.element.removeAttribute('data-edit-id')
    edit.element.style.cssText = `
      color: #000000 !important;
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      transition: all 0.3s ease !important;
    `

    // Save content
    if (this.onContentChange && this.editorRef.current) {
      this.onContentChange(this.editorRef.current.innerHTML)
    }

    // Clean up
    this.pendingEdits.delete(editId)

    console.log('✅ Approved edit:', editId)
    return true
  }

  /**
   * Approve all pending edits
   */
  approveAllEdits(): void {
    if (!this.editorRef.current) return

    const allPending = this.editorRef.current.querySelectorAll(
      '.agent-text-block[data-is-approved="false"]'
    )

    allPending.forEach((element) => {
      const htmlElement = element as HTMLElement
      htmlElement.setAttribute('data-is-approved', 'true')
      const editId = htmlElement.getAttribute('data-edit-id')
      if (editId) {
        this.pendingEdits.delete(editId)
      }
      htmlElement.removeAttribute('data-edit-id')
      htmlElement.style.cssText = `
        color: #000000 !important;
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        transition: all 0.3s ease !important;
      `
    })

    // Save content
    if (this.onContentChange) {
      this.onContentChange(this.editorRef.current.innerHTML)
    }

    console.log('✅ Approved all edits')
  }

  /**
   * Deny a pending edit - removes it from the document
   */
  denyEdit(editId: string): boolean {
    const edit = this.pendingEdits.get(editId)
    if (!edit) {
      // Try to find by element if ID not found
      if (!this.editorRef.current) {
        return false
      }
      const allPending = this.editorRef.current.querySelectorAll(
        '.agent-text-block[data-is-approved="false"]'
      )
      if (allPending && allPending.length > 0) {
        const firstPending = allPending[0] as HTMLElement
        const foundEditId = firstPending.getAttribute('data-edit-id')
        firstPending.remove()
        
        // Clean up
        if (foundEditId) {
          this.pendingEdits.delete(foundEditId)
        }
        console.log('✅ Denied edit (found by element)')
        return true
      }
      return false
    }

    // Remove the element
    edit.element.remove()

    // Clean up
    this.pendingEdits.delete(editId)

    console.log('✅ Denied edit:', editId)
    return true
  }

  /**
   * Deny all pending edits
   */
  denyAllEdits(): void {
    if (!this.editorRef.current) return

    const allPending = this.editorRef.current.querySelectorAll(
      '.agent-text-block[data-is-approved="false"]'
    )

    allPending.forEach((element) => {
      const editId = (element as HTMLElement).getAttribute('data-edit-id')
      if (editId) {
        this.pendingEdits.delete(editId)
      }
      element.remove()
    })

    console.log('✅ Denied all edits')
  }

  /**
   * Get all pending edit IDs
   */
  getPendingEditIds(): string[] {
    return Array.from(this.pendingEdits.keys())
  }

  /**
   * Check if there are any pending edits
   */
  hasPendingEdits(): boolean {
    if (!this.editorRef.current) return false
    return (
      this.pendingEdits.size > 0 ||
      this.editorRef.current.querySelectorAll(
        '.agent-text-block[data-is-approved="false"]'
      ).length > 0 ||
      this.editorRef.current.hasAttribute('data-pending-delete')
    )
  }

  /**
   * Apply a delete all operation (replace all content with empty, pending approval)
   */
  applyDeleteAll(originalContent: string): string {
    if (!this.editorRef.current) {
      console.error('Editor ref not available')
      return ''
    }

    const editor = this.editorRef.current
    const editId = `agent-delete-all-${Date.now()}`

    // Store original content in the editor's data attribute for restoration
    editor.setAttribute('data-pending-delete', 'true')
    editor.setAttribute('data-original-content', originalContent)
    editor.setAttribute('data-delete-edit-id', editId)

    // Apply pending delete styling to the entire editor
    editor.style.cssText = `
      position: relative;
    `
    
    // Add a visual indicator that content is pending deletion
    // We'll show the editor as empty but with a pending state
    const currentContent = editor.innerHTML
    
    // Clear the editor content (pending approval)
    editor.innerHTML = ''
    
    // Add a placeholder to show pending delete state
    const placeholder = document.createElement('div')
    placeholder.className = 'agent-pending-delete'
    placeholder.setAttribute('data-edit-id', editId)
    placeholder.style.cssText = `
      color: #6b7280 !important;
      background: rgba(107, 114, 128, 0.08) !important;
      border: 1px dashed #d1d5db !important;
      padding: 8px !important;
      border-radius: 4px !important;
      font-style: italic !important;
      text-align: center !important;
    `
    placeholder.textContent = '[All content will be deleted - pending approval]'
    editor.appendChild(placeholder)

    // Store the pending delete
    this.pendingEdits.set(editId, {
      id: editId,
      element: placeholder,
      originalHTML: currentContent
    })

    console.log('✅ Delete all applied (pending approval):', {
      editId,
      originalContentLength: originalContent.length
    })

    return editId
  }

  /**
   * Approve delete all operation
   */
  approveDeleteAll(editId: string): boolean {
    if (!this.editorRef.current) return false

    const editor = this.editorRef.current
    
    // Check if this is a delete all operation
    if (editor.getAttribute('data-delete-edit-id') === editId) {
      // Remove pending delete attributes
      editor.removeAttribute('data-pending-delete')
      editor.removeAttribute('data-original-content')
      editor.removeAttribute('data-delete-edit-id')
      editor.style.cssText = ''
      
      // Remove placeholder
      const placeholder = editor.querySelector('.agent-pending-delete')
      if (placeholder) {
        placeholder.remove()
      }
      
      // Editor is now empty (approved)
      editor.innerHTML = ''
      
      // Save content
      if (this.onContentChange) {
        this.onContentChange('')
      }
      
      // Clean up
      this.pendingEdits.delete(editId)
      
      console.log('✅ Delete all approved')
      return true
    }
    
    return false
  }

  /**
   * Deny delete all operation - restore original content
   */
  denyDeleteAll(editId: string): boolean {
    if (!this.editorRef.current) return false

    const editor = this.editorRef.current
    
    // Check if this is a delete all operation
    if (editor.getAttribute('data-delete-edit-id') === editId) {
      // Get original content
      const originalContent = editor.getAttribute('data-original-content') || ''
      
      // Remove pending delete attributes
      editor.removeAttribute('data-pending-delete')
      editor.removeAttribute('data-original-content')
      editor.removeAttribute('data-delete-edit-id')
      editor.style.cssText = ''
      
      // Remove placeholder
      const placeholder = editor.querySelector('.agent-pending-delete')
      if (placeholder) {
        placeholder.remove()
      }
      
      // Restore original content
      editor.innerHTML = originalContent
      
      // Save restored content
      if (this.onContentChange) {
        this.onContentChange(originalContent)
      }
      
      // Clean up
      this.pendingEdits.delete(editId)
      
      console.log('✅ Delete all denied - content restored')
      return true
    }
    
    return false
  }
}

// Hook to create and manage the edit manager
export function useAgentEditManager(
  editorRef: React.RefObject<HTMLDivElement | null>,
  onContentChange?: (content: string) => void
) {
  const managerRef = useRef<AgentEditManager | null>(null)

  if (!managerRef.current) {
    managerRef.current = new AgentEditManager(editorRef, onContentChange)
  }

  // Update onContentChange callback
  if (managerRef.current) {
    ;(managerRef.current as any).onContentChange = onContentChange
  }

  return managerRef.current
}

