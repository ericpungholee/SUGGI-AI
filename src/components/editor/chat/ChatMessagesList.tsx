import React from 'react'
import { Feather } from 'lucide-react'
import { ChatMessage } from './types'
import { ChatMessageItem } from './ChatMessageItem'

interface ChatMessagesListProps {
  messages: ChatMessage[]
  isLoading: boolean
  onApprove: () => void
  onDeny: () => void
  messagesEndRef?: React.RefObject<HTMLDivElement | null>
}

export function ChatMessagesList({ messages, isLoading, onApprove, onDeny, messagesEndRef }: ChatMessagesListProps) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 bg-gray-50 custom-scrollbar">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Feather className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Welcome to AI Assistant</h3>
          <p className="text-xs text-gray-500">Start a conversation to get help with your document</p>
          <div className="mt-4 space-y-1">
            <div className="text-xs text-gray-400">Try asking:</div>
            <div className="space-y-1">
              <div className="text-xs bg-white rounded-md px-2 py-1.5 text-gray-600 border border-gray-200">"Help me write a summary"</div>
              <div className="text-xs bg-white rounded-md px-2 py-1.5 text-gray-600 border border-gray-200">"Improve this paragraph"</div>
              <div className="text-xs bg-white rounded-md px-2 py-1.5 text-gray-600 border border-gray-200">"Add more details here"</div>
            </div>
          </div>
        </div>
      ) : (
        messages.map((message) => (
          <ChatMessageItem
            key={message.id}
            message={message}
            onApprove={onApprove}
            onDeny={onDeny}
          />
        ))
      )}
      {isLoading && (
        <div className="animate-in slide-in-from-bottom-2 duration-300 w-full">
          <div className="w-full bg-gray-100 rounded-lg px-3 py-2.5 flex items-center space-x-2">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-sm text-gray-700 whitespace-nowrap">Thinking...</span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}

