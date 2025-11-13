import React from 'react'
import { Send, Globe } from 'lucide-react'

interface ChatInputProps {
  inputValue: string
  setInputValue: (value: string) => void
  onSend: () => void
  isLoading: boolean
  forceWebSearch: boolean
  setForceWebSearch: (value: boolean) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  onKeyPress: (e: React.KeyboardEvent) => void
}

export function ChatInput({
  inputValue,
  setInputValue,
  onSend,
  isLoading,
  forceWebSearch,
  setForceWebSearch,
  inputRef,
  onKeyPress
}: ChatInputProps) {
  return (
    <div className="border-t border-gray-200 p-3 bg-white">
      <div className="relative">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder="Ask me anything about your document..."
          className="w-full resize-none border border-gray-300 rounded-md px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white transition-all duration-200"
          rows={4}
          disabled={isLoading}
        />
        <div className="absolute top-2 right-2 flex items-center space-x-1">
          <button
            onClick={() => setForceWebSearch(!forceWebSearch)}
            className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-200 ${
              forceWebSearch 
                ? 'bg-gray-900 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={forceWebSearch ? "Web search enabled - click to disable" : "Force web search - click to enable"}
          >
            <Globe className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={onSend}
            disabled={!inputValue.trim() || isLoading}
            className="w-6 h-6 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200"
          >
            <Send className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
      {forceWebSearch && (
        <div className="mt-1.5 text-xs text-gray-500 flex items-center space-x-1">
          <Globe className="h-3 w-3" />
          <span>Web search enabled - will get real-time data and generate content directly</span>
        </div>
      )}
    </div>
  )
}

