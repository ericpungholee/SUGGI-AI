'use client'
import Editor from '@/components/editor/Editor'

export default function TestEditorPage() {
  return (
    <div className="h-screen flex flex-col bg-white">
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
