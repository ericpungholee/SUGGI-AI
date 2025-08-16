'use client'
import Editor from '@/components/editor/Editor'

export default function TestEditorPage() {
  return (
    <div className="h-screen flex flex-col bg-paper">
      {/* Header */}
      <div className="h-16 border-b border-brown-light/20 bg-white/80 backdrop-blur-sm px-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Text Styling Features Test</h1>
        <div className="text-sm text-ink/60">
          Test all the enhanced text styling features
        </div>
      </div>
      
      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <Editor 
          documentId="test-editor" 
          onContentChange={(content) => console.log('Content changed:', content)}
        />
      </div>
    </div>
  )
}
