'use client'
import { useState } from 'react'
import { use } from 'react'
import EditorHeader from '@/components/editor/EditorHeader'
import Editor from '@/components/editor/Editor'
import EditorSidebar from '@/components/editor/EditorSidebar'

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [content, setContent] = useState('')

  return (
    <div className="h-screen flex flex-col bg-paper">
      {/* Header */}
      <EditorHeader documentId={id} />
      
      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <Editor 
          documentId={id} 
          onContentChange={setContent}
        />
        
        {/* Sidebar */}
        <EditorSidebar 
          content={content}
          documentId={id}
        />
      </div>
    </div>
  )
}