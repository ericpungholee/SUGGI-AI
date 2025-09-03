'use client'
import { useState, useCallback } from 'react'
import { use } from 'react'
import Editor from '@/components/editor/Editor'

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [content, setContent] = useState('')

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <Editor 
          documentId={id} 
          onContentChange={handleContentChange}
        />
      </div>
    </div>
  )
}