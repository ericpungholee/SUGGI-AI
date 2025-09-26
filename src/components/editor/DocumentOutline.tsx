'use client'
import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Hash } from 'lucide-react'

interface OutlineItem {
    id: string
    level: number
    text: string
    element: HTMLHeadingElement
}

interface DocumentOutlineProps {
    editorRef: React.RefObject<HTMLDivElement>
    isOpen: boolean
    onClose: () => void
}

export default function DocumentOutline({ editorRef, isOpen, onClose }: DocumentOutlineProps) {
    const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([])
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

    // Extract headings from the editor content
    const extractHeadings = () => {
        if (!editorRef.current) return []

        const headings = editorRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6')
        const items: OutlineItem[] = []

        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1))
            const text = heading.textContent?.trim() || ''
            
            if (text) {
                items.push({
                    id: `heading-${index}`,
                    level,
                    text,
                    element: heading as HTMLHeadingElement
                })
            }
        })

        return items
    }

    // Update outline when content changes
    useEffect(() => {
        if (!editorRef.current) return

        const updateOutline = () => {
            const items = extractHeadings()
            setOutlineItems(items)
        }

        // Initial update
        updateOutline()

        // Create observer to watch for content changes
        const observer = new MutationObserver(() => {
            updateOutline()
        })

        observer.observe(editorRef.current, {
            childList: true,
            subtree: true,
            characterData: true
        })

        return () => observer.disconnect()
    }, [editorRef])

    // Handle heading click - scroll to heading and highlight
    const handleHeadingClick = (item: OutlineItem) => {
        item.element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        })
        
        // Add temporary highlight
        item.element.style.backgroundColor = '#fff3cd'
        item.element.style.borderRadius = '4px'
        item.element.style.padding = '4px'
        
        setTimeout(() => {
            item.element.style.backgroundColor = ''
            item.element.style.borderRadius = ''
            item.element.style.padding = ''
        }, 2000)
    }

    // Toggle expansion of outline items
    const toggleExpansion = (itemId: string) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev)
            if (newSet.has(itemId)) {
                newSet.delete(itemId)
            } else {
                newSet.add(itemId)
            }
            return newSet
        })
    }

    // Render outline item
    const renderOutlineItem = (item: OutlineItem) => {
        const isExpanded = expandedItems.has(item.id)
        const hasChildren = outlineItems.some(other => 
            other.level > item.level && 
            outlineItems.indexOf(other) > outlineItems.indexOf(item) &&
            !outlineItems.slice(outlineItems.indexOf(item) + 1, outlineItems.indexOf(other))
                .some(between => between.level <= item.level)
        )

        return (
            <div key={item.id} className="outline-item">
                <div 
                    className="flex items-center gap-1 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer group"
                    onClick={() => handleHeadingClick(item)}
                    style={{ marginLeft: `${(item.level - 1) * 12}px` }}
                >
                    {hasChildren && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                toggleExpansion(item.id)
                            }}
                            className="p-0.5 hover:bg-gray-200 rounded"
                        >
                            {isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-gray-500" />
                            ) : (
                                <ChevronRight className="w-3 h-3 text-gray-500" />
                            )}
                        </button>
                    )}
                    <Hash className="w-3 h-3 text-gray-400" />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">
                        {item.text}
                    </span>
                </div>
                
                {/* Render children if expanded */}
                {isExpanded && hasChildren && (
                    <div className="ml-2">
                        {outlineItems
                            .slice(outlineItems.indexOf(item) + 1)
                            .map(child => {
                                // Check if this child belongs to the current item
                                const isChild = child.level > item.level && 
                                    !outlineItems.slice(outlineItems.indexOf(item) + 1, outlineItems.indexOf(child))
                                        .some(between => between.level <= item.level)
                                
                                if (isChild && child.level === item.level + 1) {
                                    return renderOutlineItem(child)
                                }
                                return null
                            })
                        }
                    </div>
                )}
            </div>
        )
    }

    if (!isOpen) return null

    return (
        <div className="fixed left-0 top-0 h-full bg-white border-r border-gray-200 shadow-lg z-30 w-64">
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Document Outline</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded"
                    >
                        ×
                    </button>
                </div>
            </div>
            
            <div className="p-2 overflow-y-auto h-full">
                {outlineItems.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-8">
                        No headings found
                    </div>
                ) : (
                    <div className="space-y-1">
                        {outlineItems
                            .filter(item => item.level === 1)
                            .map(item => renderOutlineItem(item))
                        }
                    </div>
                )}
            </div>
        </div>
    )
}
