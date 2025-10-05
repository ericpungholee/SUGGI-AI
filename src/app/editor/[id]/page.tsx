'use client'
import { useState, useCallback } from 'react'
import { use } from 'react'
import CursorEditor from '@/components/editor/CursorEditor'

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [content, setContent] = useState('')

  const handleContentChange = useCallback(async (newContent: string) => {
    setContent(newContent)
    
    // Note: The Editor component handles its own saving via saveDocument function
    // This callback is just for tracking content changes in the parent component
    console.log('📝 Content changed in parent component:', newContent.substring(0, 100) + '...')
  }, [id])

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <CursorEditor 
          documentId={id} 
          onContentChange={handleContentChange}
        />
      </div>
    </div>
  )
}