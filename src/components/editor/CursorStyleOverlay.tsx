'use client'
import { useEffect, useRef, useState } from 'react'
import { TextDiffHunk } from '@/types'

interface CursorStyleOverlayProps {
  hunks: TextDiffHunk[]
  isVisible: boolean
  onHunkClick?: (hunk: TextDiffHunk) => void
  onAcceptHunk?: (hunk: TextDiffHunk) => void
  onRejectHunk?: (hunk: TextDiffHunk) => void
  conflicts?: string[]
}

export default function CursorStyleOverlay({
  hunks,
  isVisible,
  onHunkClick,
  onAcceptHunk,
  onRejectHunk,
  conflicts = []
}: CursorStyleOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [animatedHunks, setAnimatedHunks] = useState<TextDiffHunk[]>([])
  const [animationFrame, setAnimationFrame] = useState(0)

  console.log('🎨 CursorStyleOverlay render:', { 
    hunksCount: hunks?.length || 0, 
    isVisible, 
    hunks: hunks?.slice(0, 2)
  });

  // Ghost typing animation - stream hunks in small chunks
  useEffect(() => {
    if (!isVisible || hunks.length === 0) {
      setAnimatedHunks([])
      setAnimationFrame(0)
      return
    }

    let currentFrame = 0
    const maxFrames = hunks.length * 4 // 4 frames per hunk for smooth animation
    const fps = 15 // 15 fps for smooth typing feel

    const animate = () => {
      if (currentFrame >= maxFrames) return

      const hunksToShow = Math.min(Math.ceil((currentFrame / maxFrames) * hunks.length), hunks.length)
      setAnimatedHunks(hunks.slice(0, hunksToShow))
      setAnimationFrame(currentFrame)

      currentFrame++
      setTimeout(animate, 1000 / fps)
    }

    animate()
  }, [hunks, isVisible])

  // Create clean overlay decorations for each hunk
  const createOverlayDecorations = () => {
    if (!overlayRef.current) return

    // Clear existing overlays
    overlayRef.current.innerHTML = ''

    // Create a single clean overlay container
    const overlayContainer = document.createElement('div')
    overlayContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 10;
    `

    animatedHunks.forEach((hunk, index) => {
      // Create a clean hunk container
      const hunkContainer = document.createElement('div')
      hunkContainer.style.cssText = `
        position: relative;
        margin: 8px 0;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        pointer-events: auto;
        cursor: pointer;
        transition: all 0.2s ease;
        max-width: 100%;
        word-wrap: break-word;
      `

      // Add hover effects
      hunkContainer.addEventListener('mouseenter', () => {
        hunkContainer.style.transform = 'translateY(-1px)'
        hunkContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
        hunkContainer.style.borderColor = '#3b82f6'
      })

      hunkContainer.addEventListener('mouseleave', () => {
        hunkContainer.style.transform = 'translateY(0)'
        hunkContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
        hunkContainer.style.borderColor = '#e5e7eb'
      })

      // Add click handler
      hunkContainer.addEventListener('click', (e) => {
        e.stopPropagation()
        onHunkClick?.(hunk)
      })

      // Create content based on hunk type
      if (hunk.replacement.length > 0) {
        // Insertion
        hunkContainer.style.borderLeftColor = '#22c55e'
        hunkContainer.style.borderLeftWidth = '4px'
        
        const displayText = hunk.replacement.length > 300 
          ? hunk.replacement.substring(0, 300) + '...' 
          : hunk.replacement

        hunkContainer.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <div style="
              background: #22c55e;
              color: white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: bold;
              flex-shrink: 0;
            ">+</div>
            <div style="flex: 1;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px; font-weight: 500;">
                ${hunk.label || 'Insert content'}
              </div>
              <div style="
                background: rgba(34, 197, 94, 0.1);
                padding: 8px 12px;
                border-radius: 4px;
                border-left: 3px solid #22c55e;
                color: #15803d;
                line-height: 1.5;
                white-space: pre-wrap;
              ">${displayText}</div>
            </div>
          </div>
        `
      } else if (hunk.to > hunk.from) {
        // Deletion
        hunkContainer.style.borderLeftColor = '#ef4444'
        hunkContainer.style.borderLeftWidth = '4px'
        
        hunkContainer.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <div style="
              background: #ef4444;
              color: white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: bold;
              flex-shrink: 0;
            ">-</div>
            <div style="flex: 1;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px; font-weight: 500;">
                ${hunk.label || 'Delete content'}
              </div>
              <div style="
                background: rgba(239, 68, 68, 0.1);
                padding: 8px 12px;
                border-radius: 4px;
                border-left: 3px solid #ef4444;
                color: #dc2626;
                line-height: 1.5;
                text-decoration: line-through;
              ">Content to be deleted</div>
            </div>
          </div>
        `
      }

      overlayContainer.appendChild(hunkContainer)
    })

    overlayRef.current.appendChild(overlayContainer)
  }

  useEffect(() => {
    createOverlayDecorations()
  }, [animatedHunks, onHunkClick, onAcceptHunk, onRejectHunk])

  if (!isVisible) return null

  return (
    <div
      ref={overlayRef}
      className="cursor-overlay-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 5
      }}
    />
  )
}
