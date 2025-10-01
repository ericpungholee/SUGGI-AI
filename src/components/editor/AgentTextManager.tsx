'use client'
import { useEffect, useRef, useCallback } from 'react'
import { AgentTextBlock, AgentTypingSession } from '@/types'

interface AgentTextManagerProps {
  editorRef: React.RefObject<HTMLDivElement | null>
  agentBlocks: AgentTextBlock[]
  currentBlock: AgentTextBlock | null
  isTyping: boolean
  typingProgress: number
  onTextInserted: (block: AgentTextBlock, position: { start: number; end: number }) => void
  onTextRemoved: (blockId: string) => void
}

export default function AgentTextManager({
  editorRef,
  agentBlocks,
  currentBlock,
  isTyping,
  typingProgress,
  onTextInserted,
  onTextRemoved
}: AgentTextManagerProps) {
  const insertedBlocksRef = useRef<Map<string, { element: HTMLElement; positions: { start: number; end: number } }>>(new Map())

  // Insert agent text into the editor
  const insertAgentText = useCallback((block: AgentTextBlock) => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const selection = window.getSelection()
    
    if (!selection || selection.rangeCount === 0) {
      // If no selection, insert at the end
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }

    const range = selection?.getRangeAt(0)
    if (!range) return
    
    // Insert text directly as plain text - no special styling or overlays
    const textNode = document.createTextNode(block.content)
    range.deleteContents()
    range.insertNode(textNode)
    
    // Position cursor after the inserted text
    range.setStartAfter(textNode)
    range.setEndAfter(textNode)
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }

    // Calculate positions for tracking
    const startPosition = getTextPosition(textNode.parentElement || editor, editor)
    const endPosition = startPosition + block.content.length

    // Store the block reference
    insertedBlocksRef.current.set(block.id, {
      element: textNode as any,
      positions: { start: startPosition, end: endPosition }
    })

    // Notify parent of text insertion
    onTextInserted(block, { start: startPosition, end: endPosition })

    console.log('✅ Inserted agent text directly:', { blockId: block.id, content: block.content })
  }, [editorRef, onTextInserted])

  // Remove agent text from the editor
  const removeAgentText = useCallback((blockId: string) => {
    const blockData = insertedBlocksRef.current.get(blockId)
    if (!blockData) return

    const { element } = blockData
    
    // Replace the element with just the text content
    const textNode = document.createTextNode(element.textContent || '')
    element.parentNode?.replaceChild(textNode, element)
    
    // Remove from tracking
    insertedBlocksRef.current.delete(blockId)
    
    // Notify parent of text removal
    onTextRemoved(blockId)

    console.log('❌ Removed agent text:', blockId)
  }, [onTextRemoved])



  // Insert blocks when they're added
  useEffect(() => {
    agentBlocks.forEach(block => {
      if (!insertedBlocksRef.current.has(block.id)) {
        insertAgentText(block)
      }
    })
  }, [agentBlocks, insertAgentText])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all agent text elements
      insertedBlocksRef.current.forEach(({ element }) => {
        if (element.parentNode) {
          const textNode = document.createTextNode(element.textContent || '')
          element.parentNode.replaceChild(textNode, element)
        }
      })
      insertedBlocksRef.current.clear()
    }
  }, [])

  return null // This component doesn't render anything visible
}

// Helper function to calculate text position
function getTextPosition(element: HTMLElement, container: HTMLElement): number {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT
  )
  
  let position = 0
  let node
  
  while (node = walker.nextNode()) {
    if (node === element) break
    if (node.parentNode === element) break
    if (element.contains(node)) break
    position += node.textContent?.length || 0
  }
  
  return position
}
