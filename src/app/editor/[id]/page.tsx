'use client'
import { useState, useCallback } from 'react'
import { use } from 'react'
import Editor from '@/components/editor/Editor'

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [content, setContent] = useState('')

  const handleContentChange = useCallback(async (newContent: string) => {
    setContent(newContent)
    
    // Save the document to the database
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newContent
        })
      })
      
      if (!response.ok) {
        console.error('Failed to save document:', await response.text())
      } else {
        console.log('Document saved successfully')
      }
    } catch (error) {
      console.error('Error saving document:', error)
    }
  }, [id])

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