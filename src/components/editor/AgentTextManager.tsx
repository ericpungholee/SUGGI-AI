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
  const typingIndicatorRef = useRef<HTMLElement | null>(null)

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
    
    // Create a span element for the agent text
    const agentSpan = document.createElement('span')
    agentSpan.className = 'agent-text-block'
    agentSpan.dataset.blockId = block.id
    agentSpan.dataset.isAgentText = 'true'
    agentSpan.dataset.isApproved = block.isApproved.toString()
    
    // Style based on approval status
    if (block.isApproved) {
      agentSpan.style.cssText = `
        color: #000000;
        background: transparent;
        border: none;
        padding: 0;
      `
    } else {
      agentSpan.style.cssText = `
        color: #6b7280;
        background: rgba(107, 114, 128, 0.1);
        border-bottom: 1px solid #d1d5db;
        padding: 2px 4px;
        border-radius: 3px;
        transition: all 0.3s ease;
        font-style: italic;
      `
    }

    // Add hover effects for non-approved text
    if (!block.isApproved) {
      agentSpan.addEventListener('mouseenter', () => {
        agentSpan.style.background = 'rgba(107, 114, 128, 0.2)'
        agentSpan.style.transform = 'scale(1.01)'
      })
      
      agentSpan.addEventListener('mouseleave', () => {
        agentSpan.style.background = 'rgba(107, 114, 128, 0.1)'
        agentSpan.style.transform = 'scale(1)'
      })
    }

    // Set the content
    agentSpan.textContent = block.content

    // Insert the text
    range.deleteContents()
    range.insertNode(agentSpan)
    
    // Position cursor after the inserted text
    range.setStartAfter(agentSpan)
    range.setEndAfter(agentSpan)
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }

    // Calculate positions for tracking
    const startPosition = getTextPosition(agentSpan, editor)
    const endPosition = startPosition + block.content.length

    // Store the block reference
    insertedBlocksRef.current.set(block.id, {
      element: agentSpan,
      positions: { start: startPosition, end: endPosition }
    })

    // Notify parent of text insertion
    onTextInserted(block, { start: startPosition, end: endPosition })

    console.log('✅ Inserted agent text:', { blockId: block.id, content: block.content, positions: { start: startPosition, end: endPosition } })
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

  // Update block approval status
  const updateBlockApproval = useCallback((block: AgentTextBlock) => {
    const blockData = insertedBlocksRef.current.get(block.id)
    if (!blockData) return

    const { element } = blockData
    
    // Update dataset
    element.dataset.isApproved = block.isApproved.toString()
    
    // Update styling
    if (block.isApproved) {
      element.style.cssText = `
        color: #000000;
        background: transparent;
        border: none;
        padding: 0;
        transform: none;
      `
    } else {
      element.style.cssText = `
        color: #6b7280;
        background: rgba(107, 114, 128, 0.1);
        border-bottom: 1px solid #d1d5db;
        padding: 2px 4px;
        border-radius: 3px;
        transition: all 0.3s ease;
        font-style: italic;
      `
    }

    console.log('✅ Updated block approval:', { blockId: block.id, isApproved: block.isApproved })
  }, [])

  // Show typing indicator
  const showTypingIndicator = useCallback(() => {
    if (!editorRef.current || !currentBlock) return

    // Remove existing indicator
    if (typingIndicatorRef.current) {
      typingIndicatorRef.current.remove()
      typingIndicatorRef.current = null
    }

    const editor = editorRef.current
    const selection = window.getSelection()
    
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    
    // Create typing indicator
    const indicator = document.createElement('span')
    indicator.className = 'agent-typing-indicator'
    indicator.style.cssText = `
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.2);
      border-bottom: 2px dashed #3b82f6;
      padding: 2px 4px;
      border-radius: 3px;
      animation: blink 1s infinite;
    `

    // Add blinking animation
    const style = document.createElement('style')
    style.textContent = `
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }
    `
    document.head.appendChild(style)

    // Insert indicator
    range.deleteContents()
    range.insertNode(indicator)
    
    // Position cursor after indicator
    range.setStartAfter(indicator)
    range.setEndAfter(indicator)
    selection.removeAllRanges()
    selection.addRange(range)

    typingIndicatorRef.current = indicator

    // Clean up animation style after a delay
    setTimeout(() => {
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }, 10000)
  }, [editorRef, currentBlock])

  // Hide typing indicator
  const hideTypingIndicator = useCallback(() => {
    if (typingIndicatorRef.current) {
      typingIndicatorRef.current.remove()
      typingIndicatorRef.current = null
    }
  }, [])

  // Handle real-time typing animation
  const handleTypingAnimation = useCallback((block: AgentTextBlock, progress: number) => {
    if (!editorRef.current) return

    const blockData = insertedBlocksRef.current.get(block.id)
    if (!blockData) return

    const { element } = blockData
    const contentLength = Math.floor(block.content.length * progress)
    const visibleContent = block.content.substring(0, contentLength)
    
    // Update the element content
    element.textContent = visibleContent
    
    // Add a blinking cursor effect
    if (progress < 1) {
      element.style.borderRight = '2px solid #3b82f6'
      element.style.animation = 'blink 1s infinite'
    } else {
      element.style.borderRight = 'none'
      element.style.animation = 'none'
    }
  }, [editorRef])

  // Insert blocks when they're added
  useEffect(() => {
    agentBlocks.forEach(block => {
      if (!insertedBlocksRef.current.has(block.id)) {
        insertAgentText(block)
      } else {
        // Update existing block if approval status changed
        updateBlockApproval(block)
      }
    })
  }, [agentBlocks, insertAgentText, updateBlockApproval])

  // Handle typing indicator
  useEffect(() => {
    if (isTyping && currentBlock) {
      showTypingIndicator()
    } else {
      hideTypingIndicator()
    }
  }, [isTyping, currentBlock, showTypingIndicator, hideTypingIndicator])

  // Handle typing progress
  useEffect(() => {
    if (currentBlock && isTyping) {
      handleTypingAnimation(currentBlock, typingProgress / 100)
    }
  }, [currentBlock, isTyping, typingProgress, handleTypingAnimation])

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
      
      // Clean up typing indicator
      hideTypingIndicator()
    }
  }, [hideTypingIndicator])

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
