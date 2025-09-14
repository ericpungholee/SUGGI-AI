'use client'
import { useState } from 'react'
import { Check, X, Eye, MoreHorizontal } from 'lucide-react'

interface FloatingDiffToolbarProps {
  isVisible: boolean
  onAcceptAll: () => void
  onRejectAll: () => void
  onReviewChanges: () => void
  hunksCount: number
  wordsAdded: number
  wordsRemoved: number
}

export default function FloatingDiffToolbar({
  isVisible,
  onAcceptAll,
  onRejectAll,
  onReviewChanges,
  hunksCount,
  wordsAdded,
  wordsRemoved
}: FloatingDiffToolbarProps) {
  const [showDetails, setShowDetails] = useState(false)

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 border border-gray-200 rounded-xl shadow-xl p-4 min-w-[300px] backdrop-blur-sm bg-white/95">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-semibold text-gray-800">Live Preview</span>
          <div className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
            Ready
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <MoreHorizontal className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {showDetails && (
        <div className="mb-3 text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Changes:</span>
            <span className="font-medium">{hunksCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Added:</span>
            <span className="text-green-600 font-medium">+{wordsAdded}</span>
          </div>
          <div className="flex justify-between">
            <span>Removed:</span>
            <span className="text-red-600 font-medium">-{wordsRemoved}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onAcceptAll}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Check className="w-4 h-4" />
          Accept All
        </button>
        
        <button
          onClick={onRejectAll}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <X className="w-4 h-4" />
          Reject All
        </button>
        
        <button
          onClick={onReviewChanges}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Eye className="w-4 h-4" />
          Review
        </button>
      </div>

      <div className="mt-2 text-xs text-gray-500 text-center">
        Changes are previewed but not saved until you accept
      </div>
    </div>
  )
}
