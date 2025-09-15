'use client'
import { useState } from 'react'
import { Check, X, AlertTriangle } from 'lucide-react'
import { TextDiffHunk } from '@/types'

interface GutterPillsProps {
  hunks: TextDiffHunk[]
  onAcceptHunk: (hunk: TextDiffHunk) => void
  onRejectHunk: (hunk: TextDiffHunk) => void
  conflicts?: string[]
}

export default function GutterPills({
  hunks,
  onAcceptHunk,
  onRejectHunk,
  conflicts = []
}: GutterPillsProps) {
  const [hoveredPill, setHoveredPill] = useState<string | null>(null)

  const getPillColor = (hunk: TextDiffHunk) => {
    if (conflicts.includes(hunk.blockId)) {
      return 'bg-yellow-100 border-yellow-300 text-yellow-800'
    }
    
    if (hunk.sizeDelta > 0) {
      return 'bg-blue-100 border-blue-300 text-blue-800'
    } else if (hunk.sizeDelta < 0) {
      return 'bg-red-100 border-red-300 text-red-800'
    }
    
    return 'bg-gray-100 border-gray-300 text-gray-800'
  }

  const getPillIcon = (hunk: TextDiffHunk) => {
    if (conflicts.includes(hunk.blockId)) {
      return <AlertTriangle className="w-3 h-3" />
    }
    
    if (hunk.sizeDelta > 0) {
      return <span className="text-xs">+</span>
    } else if (hunk.sizeDelta < 0) {
      return <span className="text-xs">-</span>
    }
    
    return <span className="text-xs">~</span>
  }

  return (
    <div className="absolute left-0 top-0 w-8 z-20">
      {hunks.map((hunk, index) => (
        <div
          key={hunk.blockId}
          className="relative"
          style={{ marginTop: `${index * 25 + 20}px` }}
        >
          <div
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs font-medium cursor-pointer transition-all duration-200 ${getPillColor(hunk)}`}
            onMouseEnter={() => setHoveredPill(hunk.blockId)}
            onMouseLeave={() => setHoveredPill(null)}
            style={{
              transform: hoveredPill === hunk.blockId ? 'scale(1.1)' : 'scale(1)',
              boxShadow: hoveredPill === hunk.blockId ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
            }}
          >
            {getPillIcon(hunk)}
            <span className="text-xs">
              {Math.abs(hunk.sizeDelta)}
            </span>
          </div>

          {/* Popover for Accept/Reject */}
          {hoveredPill === hunk.blockId && (
            <div className="absolute left-10 top-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-30 min-w-[120px]">
              <div className="text-xs text-gray-600 mb-2 font-medium">
                {hunk.label}
              </div>
              
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAcceptHunk(hunk)
                    setHoveredPill(null)
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Accept
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRejectHunk(hunk)
                    setHoveredPill(null)
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Reject
                </button>
              </div>

              {conflicts.includes(hunk.blockId) && (
                <div className="mt-2 text-xs text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Content changed
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
