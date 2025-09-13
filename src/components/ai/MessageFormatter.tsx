'use client'

import React from 'react'
import { ExternalLink } from 'lucide-react'

interface MessageFormatterProps {
  content: string
  className?: string
}

export default function MessageFormatter({ content, className = '' }: MessageFormatterProps) {
  // Function to format the message content with proper styling
  const formatMessage = (text: string) => {
    // Split content into lines for processing
    const lines = text.split('\n')
    const formattedElements: React.ReactNode[] = []
    let currentIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Skip empty lines
      if (!line) {
        formattedElements.push(<br key={`br-${currentIndex++}`} />)
        continue
      }

      // Check for headings (Sources, etc.)
      if (line.match(/^Sources with details?:?$/i) || line.match(/^Sources?:?$/i)) {
        formattedElements.push(
          <h4 key={`heading-${currentIndex++}`} className="font-semibold text-gray-800 mt-4 mb-3 text-sm border-b border-gray-200 pb-1">
            {line}
          </h4>
        )
        continue
      }

      // Check for bullet points
      if (line.match(/^[-*•]\s/)) {
        const bulletContent = line.replace(/^[-*•]\s/, '')
        formattedElements.push(
          <div key={`bullet-${currentIndex++}`} className="flex items-start gap-3 mb-2 pl-2">
            <span className="text-gray-500 mt-1 text-xs">•</span>
            <div className="text-sm text-gray-700 leading-relaxed flex-1">
              {formatInlineContent(bulletContent)}
            </div>
          </div>
        )
        continue
      }

      // Check for numbered lists
      if (line.match(/^\d+\.\s/)) {
        const number = line.match(/^(\d+)\./)?.[1]
        const listContent = line.replace(/^\d+\.\s/, '')
        formattedElements.push(
          <div key={`numbered-${currentIndex++}`} className="flex items-start gap-2 mb-1">
            <span className="text-gray-600 mt-1 text-sm font-medium">{number}.</span>
            <span className="text-sm text-gray-700">{formatInlineContent(listContent)}</span>
          </div>
        )
        continue
      }

      // Regular paragraphs
      formattedElements.push(
        <p key={`para-${currentIndex++}`} className="text-sm text-gray-700 mb-2 leading-relaxed">
          {formatInlineContent(line)}
        </p>
      )
    }

    return formattedElements
  }

  // Function to format inline content (links, bold, etc.)
  const formatInlineContent = (text: string) => {
    const elements: React.ReactNode[] = []
    let currentIndex = 0

    // Split by markdown links [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let lastIndex = 0
    let match

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        elements.push(
          <span key={`text-${currentIndex++}`}>
            {text.slice(lastIndex, match.index)}
          </span>
        )
      }

      // Add the link
      elements.push(
        <a
          key={`link-${currentIndex++}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1 transition-colors font-medium"
        >
          {match[1]}
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      )

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(
        <span key={`text-${currentIndex++}`}>
          {text.slice(lastIndex)}
        </span>
      )
    }

    return elements.length > 0 ? elements : text
  }

  return (
    <div className={`prose prose-sm max-w-none text-gray-800 ${className}`}>
      {formatMessage(content)}
    </div>
  )
}
