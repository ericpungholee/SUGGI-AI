'use client'
import { useState, useEffect } from 'react'
import { X, FileText, Hash, Clock, Sparkles, Eye, EyeOff, TrendingUp } from 'lucide-react'

interface EditorSidebarProps {
  content?: string
  documentId?: string
}

interface Heading {
  id: string
  text: string
  level: number
  tag: string
}

export default function EditorSidebar({ 
  content = '', 
  documentId
}: EditorSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [headings, setHeadings] = useState<Heading[]>([])

  // Prevent hydration mismatch by only running on client
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && content) {
      setHeadings(getHeadings())
    }
  }, [content, mounted])

  const getWordCount = () => {
    const text = content.replace(/<[^>]*>/g, '')
    return text.split(/\s+/).filter(Boolean).length
  }

  const getCharCount = () => {
    return content.replace(/<[^>]*>/g, '').length
  }

  const getReadingTime = () => {
    const words = getWordCount()
    const wordsPerMinute = 200
    const minutes = Math.ceil(words / wordsPerMinute)
    return minutes
  }

  const getHeadings = (): Heading[] => {
    if (typeof window === 'undefined') return []
    
    try {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = content
      const headingElements = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6')
      return Array.from(headingElements).map((heading, index) => ({
        id: `heading-${index}`,
        text: heading.textContent || '',
        level: parseInt(heading.tagName.charAt(1)),
        tag: heading.tagName.toLowerCase()
      }))
    } catch (error) {
      console.error('Error parsing headings:', error)
      return []
    }
  }

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className="fixed right-4 top-24 p-3 bg-white border border-brown-light/20 rounded-lg shadow-sm hover:shadow-md transition-all hover:bg-stone-light group"
        title="Open document info"
      >
        <FileText className="w-5 h-5 text-ink group-hover:text-purple-600 transition-colors" />
      </button>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 top-24 p-3 bg-white border border-brown-light/20 rounded-lg shadow-sm hover:shadow-md transition-all hover:bg-stone-light group"
        title="Open document info"
      >
        <FileText className="w-5 h-5 text-ink group-hover:text-purple-600 transition-colors" />
      </button>
    )
  }

  return (
    <aside className="w-80 bg-white border-l border-brown-light/20 p-6 overflow-y-auto shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-ink text-lg">Document Info</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-2 hover:bg-stone-light rounded-lg transition-colors"
          title="Close sidebar"
        >
          <X className="w-4 h-4 text-ink/60" />
        </button>
      </div>

      {/* Document Stats */}
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200/50">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-ink">Words</span>
            </div>
            <span className="text-2xl font-bold text-blue-700">{getWordCount()}</span>
          </div>
          
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200/50">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-ink">Reading time</span>
            </div>
            <span className="text-2xl font-bold text-blue-700">{getReadingTime()} min</span>
          </div>
        </div>
        
        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200/50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-ink">Characters</span>
          </div>
          <span className="text-xl font-semibold text-purple-700">{getCharCount().toLocaleString()}</span>
        </div>
      </div>

      {/* Document Outline */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Document Outline
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {headings.length > 0 ? (
            headings.map((heading, index) => (
              <button 
                key={heading.id}
                className="w-full text-left px-3 py-2 text-sm text-ink/70 hover:bg-stone-light rounded-lg transition-colors flex items-center gap-2"
                style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                title={`Go to ${heading.text}`}
              >
                <span className="text-xs text-ink/40">{heading.tag}</span>
                {heading.text}
              </button>
            ))
          ) : (
            <p className="text-sm text-ink/40 px-3 py-2">No headings found. Use H1, H2, H3 tags to create an outline.</p>
          )}
        </div>
      </div>

      {/* AI Suggestions */}
      <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200/50">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <h4 className="text-sm font-semibold text-ink">AI Writing Assistant</h4>
        </div>
        <p className="text-xs text-ink/60 mb-4">Get help with grammar, style, and content suggestions</p>
        <div className="space-y-2">
          <button className="w-full px-3 py-2 bg-white text-sm text-ink rounded-lg hover:shadow-sm transition-all border border-purple-200/50 hover:border-purple-300">
            Improve writing
          </button>
          <button className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-all">
            Generate ideas
          </button>
        </div>
      </div>

      {/* Document ID */}
      {documentId && (
        <div className="mt-6 p-3 bg-stone-light rounded-lg">
          <p className="text-xs text-ink/40 mb-1">Document ID</p>
          <p className="text-sm font-mono text-ink/60 break-all">{documentId}</p>
        </div>
      )}
    </aside>
  )
}