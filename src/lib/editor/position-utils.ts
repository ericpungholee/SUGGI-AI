/**
 * Shared utility functions for editor position handling
 */

import React from 'react'

/**
 * Get the text position of a node within a container
 */
export function getTextPosition(node: Node, container: Node): number {
  let position = 0
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  )
  
  let currentNode
  while (currentNode = walker.nextNode()) {
    if (currentNode === node) {
      return position
    }
    position += currentNode.textContent?.length || 0
  }
  
  return position
}

/**
 * Get text node at a specific position within a container
 */
export function getTextNodeAtPosition(container: Node, position: number): { node: Text; offset: number } | null {
  let currentPosition = 0
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  )
  
  let currentNode
  while (currentNode = walker.nextNode()) {
    const nodeLength = currentNode.textContent?.length || 0
    if (currentPosition + nodeLength >= position) {
      return {
        node: currentNode as Text,
        offset: position - currentPosition
      }
    }
    currentPosition += nodeLength
  }
  
  return null
}

/**
 * Get current cursor context (position and selection)
 */
export function getCursorContext(editorRef: React.RefObject<HTMLDivElement> | undefined): { selection: string; cursorPosition: string } {
  if (!editorRef?.current) return { selection: '', cursorPosition: 'end' }

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return { selection: '', cursorPosition: 'end' }
  }

  const range = selection.getRangeAt(0)
  const selectedText = range.toString()
  
  // Determine cursor position relative to document structure
  let cursorPosition = 'end'
  if (selectedText) {
    cursorPosition = 'selection'
  } else {
    // Check if cursor is at the beginning of the document
    const textContent = editorRef.current.textContent || ''
    const textPosition = getTextPosition(range.startContainer, editorRef.current)
    if (textPosition <= 50) { // Within first 50 characters
      cursorPosition = 'beginning'
    } else if (textPosition >= textContent.length - 50) { // Within last 50 characters
      cursorPosition = 'end'
    } else {
      cursorPosition = 'middle'
    }
  }

  return { selection: selectedText, cursorPosition }
}
