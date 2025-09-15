'use client'
import { useState } from 'react'
import { useRealTimeAgentTyping } from '@/hooks/useRealTimeAgentTyping'
import AgentTextOverlay from './AgentTextOverlay'
import AgentTextManager from './AgentTextManager'

export default function AgentTypingDemo() {
  const [documentId] = useState('demo-doc')
  const [documentContent, setDocumentContent] = useState('This is a demo document. ')
  const [editorRef] = useState({ current: null as HTMLDivElement | null })

  const agentTyping = useRealTimeAgentTyping({
    documentId,
    onTypingStart: (session) => {
      console.log('🚀 Demo: Agent typing started:', session.id)
    },
    onTypingProgress: (block, progress) => {
      console.log('⌨️ Demo: Typing progress:', { blockId: block.id, progress })
    },
    onTypingComplete: (session) => {
      console.log('✅ Demo: Agent typing completed:', session.id)
    },
    onApprovalChange: (event) => {
      console.log('📝 Demo: Approval changed:', event)
    }
  })

  const handleStartTyping = async () => {
    const message = "Write a short paragraph about artificial intelligence and its impact on modern society."
    await agentTyping.startTypingSession(message, documentContent)
  }

  const handleCancelTyping = () => {
    agentTyping.cancelTypingSession()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Agent Typing Demo</h1>
      
      <div className="mb-6">
        <button
          onClick={handleStartTyping}
          disabled={agentTyping.isTyping}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded mr-4"
        >
          {agentTyping.isTyping ? 'Agent is typing...' : 'Start Agent Typing'}
        </button>
        
        {agentTyping.isTyping && (
          <button
            onClick={handleCancelTyping}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Cancel Typing
          </button>
        )}
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Status:</h2>
        <div className="text-sm space-y-1">
          <p>Is Typing: {agentTyping.isTyping ? 'Yes' : 'No'}</p>
          <p>Progress: {agentTyping.typingProgress.toFixed(1)}%</p>
          <p>Approved Blocks: {agentTyping.approvedBlocks.length}</p>
          <p>Pending Blocks: {agentTyping.pendingBlocks.length}</p>
        </div>
      </div>

      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          className="min-h-32 p-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          dangerouslySetInnerHTML={{ __html: documentContent }}
          onChange={(e) => setDocumentContent(e.currentTarget.innerHTML)}
        />

        {/* Agent Text Manager */}
        <AgentTextManager
          editorRef={editorRef}
          agentBlocks={agentTyping.approvedBlocks}
          currentBlock={agentTyping.currentBlock}
          isTyping={agentTyping.isTyping}
          typingProgress={agentTyping.typingProgress}
          onTextInserted={(block, positions) => {
            console.log('📝 Text inserted:', { blockId: block.id, positions })
          }}
          onTextRemoved={(blockId) => {
            console.log('🗑️ Text removed:', blockId)
          }}
        />

        {/* Agent Text Overlay */}
        <AgentTextOverlay
          blocks={agentTyping.approvedBlocks}
          currentBlock={agentTyping.currentBlock}
          isTyping={agentTyping.isTyping}
          typingProgress={agentTyping.typingProgress}
          onApproveBlock={agentTyping.approveBlock}
          onRejectBlock={agentTyping.rejectBlock}
          onBlockClick={(block) => {
            console.log('🎯 Block clicked:', block.id)
          }}
        />
      </div>

      {agentTyping.error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {agentTyping.error}
        </div>
      )}
    </div>
  )
}
