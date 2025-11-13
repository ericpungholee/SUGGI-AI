import React from 'react'
import { X, Feather } from 'lucide-react'

interface ChatHeaderProps {
  onClose: () => void
  onClear: () => void
}

export function ChatHeader({ onClose, onClear }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center space-x-2">
        <div className="w-7 h-7 bg-gray-900 rounded-md flex items-center justify-center">
          <Feather className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">AI Assistant</h2>
        </div>
      </div>
      <div className="flex items-center space-x-1">
        <button
          onClick={onClear}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all duration-200"
          title="Clear chat"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all duration-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

