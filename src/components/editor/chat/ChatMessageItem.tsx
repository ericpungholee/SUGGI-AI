import React from 'react'
import { Check, XCircle } from 'lucide-react'
import { ChatMessage } from './types'

interface ChatMessageItemProps {
  message: ChatMessage
  onApprove: () => void
  onDeny: () => void
}

export function ChatMessageItem({ message, onApprove, onDeny }: ChatMessageItemProps) {
  return (
    <div className="animate-in slide-in-from-bottom-2 duration-300 w-full">
      <div
        className={`w-full rounded-lg px-3 py-2.5 ${
          message.type === 'user'
            ? 'bg-gray-900 text-white'
            : message.type === 'approval'
            ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            : 'bg-white text-gray-900'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap leading-relaxed break-words hyphens-auto [word-break:break-word]">
          {message.content}
        </div>
        {message.type === 'approval' && message.approvalData?.patch && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="text-xs font-semibold text-gray-700 mb-2">Patch Preview:</div>
            <pre className="text-xs font-mono bg-white p-2 rounded border border-gray-200 overflow-x-auto max-h-64 overflow-y-auto">
              {message.approvalData.patch}
            </pre>
          </div>
        )}
        {message.type === 'approval' && (
          <div className="mt-3 flex space-x-2">
            <button
              onClick={onApprove}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 flex items-center space-x-2 transition-all duration-200"
            >
              <Check className="h-4 w-4" />
              <span>Approve</span>
            </button>
            <button
              onClick={onDeny}
              className="px-4 py-2 bg-white text-black text-sm rounded-md border border-gray-300 hover:bg-gray-100 flex items-center space-x-2 transition-all duration-200"
            >
              <XCircle className="h-4 w-4" />
              <span>Deny</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

