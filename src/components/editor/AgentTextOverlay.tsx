'use client'
import { useEffect, useRef, useState } from 'react'
import { AgentTextBlock, AgentTypingSession } from '@/types'
import { Check, X, Clock } from 'lucide-react'

interface AgentTextOverlayProps {
  blocks: AgentTextBlock[]
  currentBlock?: AgentTextBlock | null
  isTyping: boolean
  typingProgress: number
  onApproveBlock: (blockId: string) => void
  onRejectBlock: (blockId: string) => void
  onBlockClick?: (block: AgentTextBlock) => void
}

export default function AgentTextOverlay({
  blocks,
  currentBlock,
  isTyping,
  typingProgress,
  onApproveBlock,
  onRejectBlock,
  onBlockClick
}: AgentTextOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [animatedBlocks, setAnimatedBlocks] = useState<AgentTextBlock[]>([])

  // Only create overlays if we're in an active typing session
  useEffect(() => {
    if (blocks.length === 0) {
      setAnimatedBlocks([])
      return
    }

    // Only animate blocks if we're currently typing or have pending blocks
    if (isTyping || blocks.some(block => !block.isApproved)) {
      const animateBlocks = async () => {
        for (let i = 0; i < blocks.length; i++) {
          setAnimatedBlocks(prev => [...prev, blocks[i]])
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
      animateBlocks()
    }
  }, [blocks, isTyping])

  // Clean up overlays when typing is complete
  useEffect(() => {
    if (!isTyping && overlayRef.current) {
      overlayRef.current.innerHTML = ''
    }
  }, [isTyping])

  // Create overlay elements for each block
  const createOverlayElements = () => {
    if (!overlayRef.current) return

    // Clear existing overlays
    overlayRef.current.innerHTML = ''

    animatedBlocks.forEach((block, index) => {
      const overlay = document.createElement('div')
      overlay.className = 'agent-text-overlay'
      overlay.dataset.blockId = block.id
      
      // Base styling - ensure overlays stay within editor bounds
      overlay.style.cssText = `
        position: absolute;
        pointer-events: auto;
        z-index: 15;
        border-radius: 6px;
        padding: 8px 12px;
        margin: 4px;
        font-size: inherit;
        line-height: inherit;
        font-family: inherit;
        transition: all 0.3s ease;
        cursor: pointer;
        user-select: none;
        max-width: 80%;
        word-wrap: break-word;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        left: 0;
        top: 0;
        transform: translate(0, 0);
      `

      // Style based on block status
      if (block.isApproved) {
        // Approved blocks - black text with subtle border
        overlay.style.cssText += `
          background: rgba(0, 0, 0, 0.02);
          border: 2px solid rgba(0, 0, 0, 0.1);
          color: #000000;
        `
      } else if (block.id === currentBlock?.id && isTyping) {
        // Currently typing block - pulsing light blue
        overlay.style.cssText += `
          background: rgba(59, 130, 246, 0.2);
          border: 2px solid #3b82f6;
          color: #1e40af;
          animation: pulse 1.5s ease-in-out infinite;
        `
      } else {
        // Pending approval blocks - light blue
        overlay.style.cssText += `
          background: rgba(59, 130, 246, 0.15);
          border: 2px solid #3b82f6;
          color: #1e40af;
        `
      }

      // Add the content
      const content = document.createElement('div')
      content.style.cssText = `
        margin-bottom: 8px;
        line-height: 1.5;
      `
      content.textContent = block.content

      // Add action buttons for non-approved blocks
      if (!block.isApproved) {
        const buttonContainer = document.createElement('div')
        buttonContainer.style.cssText = `
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 8px;
          opacity: 0.8;
        `

        // Approve button
        const approveBtn = document.createElement('button')
        approveBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        `
        approveBtn.style.cssText = `
          background: #22c55e;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          transition: all 0.2s ease;
        `
        approveBtn.addEventListener('mouseenter', () => {
          approveBtn.style.background = '#16a34a'
        })
        approveBtn.addEventListener('mouseleave', () => {
          approveBtn.style.background = '#22c55e'
        })
        approveBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          onApproveBlock(block.id)
        })

        // Reject button
        const rejectBtn = document.createElement('button')
        rejectBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        `
        rejectBtn.style.cssText = `
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          transition: all 0.2s ease;
        `
        rejectBtn.addEventListener('mouseenter', () => {
          rejectBtn.style.background = '#dc2626'
        })
        rejectBtn.addEventListener('mouseleave', () => {
          rejectBtn.style.background = '#ef4444'
        })
        rejectBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          onRejectBlock(block.id)
        })

        buttonContainer.appendChild(approveBtn)
        buttonContainer.appendChild(rejectBtn)

        overlay.appendChild(content)
        overlay.appendChild(buttonContainer)
      } else {
        // Approved blocks show a checkmark
        const approvedIndicator = document.createElement('div')
        approvedIndicator.style.cssText = `
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #16a34a;
          margin-top: 4px;
        `
        approvedIndicator.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          Approved
        `
        overlay.appendChild(content)
        overlay.appendChild(approvedIndicator)
      }

      // Add click handler
      overlay.addEventListener('click', () => {
        onBlockClick?.(block)
      })

      // Add hover effects
      overlay.addEventListener('mouseenter', () => {
        if (!block.isApproved) {
          overlay.style.transform = 'scale(1.02)'
          overlay.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
        }
      })

      overlay.addEventListener('mouseleave', () => {
        overlay.style.transform = 'scale(1)'
        overlay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
      })

      // Position the overlay
      overlay.style.top = `${index * 80 + 20}px`
      overlay.style.left = '20px'

      overlayRef.current?.appendChild(overlay)
    })
  }

  useEffect(() => {
    createOverlayElements()
  }, [animatedBlocks, currentBlock, isTyping, typingProgress, onApproveBlock, onRejectBlock, onBlockClick])

  // Add CSS animation for pulse effect
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  if (blocks.length === 0) return null

  return (
    <div 
      ref={overlayRef} 
      className="agent-text-overlay-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'hidden',
        contain: 'layout'
      }}
    />
  )
}
