'use client'
import { useEffect, useRef, useState } from 'react'
import { TextDiffHunk } from '@/types'

interface EditPreviewOverlayProps {
  hunks: TextDiffHunk[]
  isVisible: boolean
  onHunkClick?: (hunk: TextDiffHunk) => void
  onAcceptHunk?: (hunk: TextDiffHunk) => void
  onRejectHunk?: (hunk: TextDiffHunk) => void
}

export default function EditPreviewOverlay({
  hunks,
  isVisible,
  onHunkClick,
  onAcceptHunk,
  onRejectHunk
}: EditPreviewOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [animatedHunks, setAnimatedHunks] = useState<TextDiffHunk[]>([])
  const [animationFrame, setAnimationFrame] = useState(0)

  console.log('🎨 EditPreviewOverlay render:', { 
    hunksCount: hunks?.length || 0, 
    isVisible, 
    hunks: hunks?.slice(0, 2) // Show first 2 hunks for debugging
  });

  // Ghost typing animation - feed hunks in small chunks
  useEffect(() => {
    if (!isVisible || hunks.length === 0) {
      setAnimatedHunks([])
      setAnimationFrame(0)
      return
    }

    let currentFrame = 0
    const maxFrames = hunks.length * 3 // 3 frames per hunk for smooth animation
    const fps = 12 // 12 fps for smooth but not too fast animation

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

  // Create overlay elements for each hunk
  const createOverlayElements = () => {
    if (!overlayRef.current) return

    // Clear existing overlays
    overlayRef.current.innerHTML = ''

    animatedHunks.forEach((hunk, index) => {
      const overlay = document.createElement('div')
      overlay.className = 'edit-preview-overlay'
      overlay.style.cssText = `
        position: absolute;
        pointer-events: auto;
        z-index: 10;
        border-radius: 3px;
        padding: 2px 4px;
        margin: 1px;
        font-size: inherit;
        line-height: inherit;
        font-family: inherit;
        transition: all 0.2s ease;
        cursor: pointer;
        user-select: none;
      `

      // Style based on hunk type
      if (hunk.replacement.length > 0 && hunk.to > hunk.from) {
        // Rewrite: show both delete and insert
        overlay.innerHTML = `
          <span style="background: rgba(239, 68, 68, 0.1); text-decoration: line-through; color: #dc2626; padding: 1px 2px; border-radius: 2px; margin-right: 2px;">
            ${hunk.replacement.substring(0, Math.min(50, hunk.replacement.length))}${hunk.replacement.length > 50 ? '...' : ''}
          </span>
          <span style="background: rgba(34, 197, 94, 0.15); border-bottom: 2px solid #22c55e; color: #15803d; padding: 1px 2px; border-radius: 2px;">
            ${hunk.replacement}
          </span>
        `
      } else if (hunk.replacement.length > 0) {
        // Insert: green background with underline
        overlay.innerHTML = `
          <span style="background: rgba(34, 197, 94, 0.15); border-bottom: 2px solid #22c55e; color: #15803d; padding: 1px 2px; border-radius: 2px;">
            ${hunk.replacement}
          </span>
        `
      } else {
        // Delete: red strikethrough
        overlay.innerHTML = `
          <span style="background: rgba(239, 68, 68, 0.1); text-decoration: line-through; color: #dc2626; padding: 1px 2px; border-radius: 2px;">
            [Delete: ${hunk.label}]
          </span>
        `
      }

      // Add click handlers
      overlay.addEventListener('click', (e) => {
        e.stopPropagation()
        onHunkClick?.(hunk)
      })

      // Add hover effects
      overlay.addEventListener('mouseenter', () => {
        overlay.style.transform = 'scale(1.02)'
        overlay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
      })

      overlay.addEventListener('mouseleave', () => {
        overlay.style.transform = 'scale(1)'
        overlay.style.boxShadow = 'none'
      })

      // Position the overlay (simplified - in real implementation, you'd map to actual editor positions)
      overlay.style.top = `${index * 25 + 20}px`
      overlay.style.left = '20px'
      overlay.style.width = '300px'

      overlayRef.current.appendChild(overlay)
    })
  }

  useEffect(() => {
    createOverlayElements()
  }, [animatedHunks, onHunkClick, onAcceptHunk, onRejectHunk])

  if (!isVisible) return null

  return (
    <div
      ref={overlayRef}
      className="edit-preview-overlay-container"
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