import React from 'react'
import { CheckCircle, X, Eye } from 'lucide-react'

interface DiffToolbarProps {
  isVisible: boolean
  onAcceptAll: () => void
  onRejectAll: () => void
  onReviewChanges: () => void
  isLoading: boolean
  blockCount: number
}

export function DiffToolbar({
  isVisible,
  onAcceptAll,
  onRejectAll,
  onReviewChanges,
  isLoading,
  blockCount
}: DiffToolbarProps) {
  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 font-medium">
          {blockCount} change{blockCount !== 1 ? 's' : ''}
        </span>
        
        <div className="h-4 w-px bg-gray-300" />
        
        <div className="flex items-center gap-1">
          <button
            onClick={onRejectAll}
            disabled={isLoading}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="Reject all changes"
          >
            <X className="w-4 h-4" />
          </button>
          
          <button
            onClick={onReviewChanges}
            disabled={isLoading}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            title="Review changes"
          >
            <Eye className="w-4 h-4" />
          </button>
          
          <button
            onClick={onAcceptAll}
            disabled={isLoading}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            title="Accept all changes"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
