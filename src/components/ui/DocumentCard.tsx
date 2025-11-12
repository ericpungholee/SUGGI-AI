'use client'
import { FileText, MoreVertical, Bookmark, Clock, Edit3, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

interface DocumentCardProps {
    id: string
    title: string
    preview: string
    lastModified: string
    wordCount: number
    starred: boolean
    onToggleStar?: (docId: string, e: React.MouseEvent) => void
    onDelete?: (docId: string) => void
    showActions?: boolean
    className?: string
}

export default function DocumentCard({
    id,
    title,
    preview,
    lastModified,
    wordCount,
    starred,
    onToggleStar,
    onDelete,
    showActions = true,
    className = ""
}: DocumentCardProps) {
    const [showMoreOptions, setShowMoreOptions] = useState(false)

    const handleMoreOptions = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setShowMoreOptions(!showMoreOptions)
    }

    const handleToggleStar = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (onToggleStar) {
            onToggleStar(id, e)
        }
    }

    const handleDelete = () => {
        if (onDelete) {
            onDelete(id)
        }
        setShowMoreOptions(false)
    }

    return (
        <div className={`group relative bg-white border border-black rounded-xl p-4 hover:bg-gray-50 transition-all ${className}`}>
            <div className="flex items-start justify-between mb-3">
                <FileText className="w-5 h-5 text-black" />
                {showActions && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onToggleStar && (
                            <button
                                onClick={handleToggleStar}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                type="button"
                            >
                                <Bookmark className={`w-4 h-4 ${starred ? 'fill-black text-black' : 'text-black/40'}`} />
                            </button>
                        )}
                        <button
                            onClick={handleMoreOptions}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            type="button"
                        >
                            <MoreVertical className="w-4 h-4 text-black" />
                        </button>
                    </div>
                )}
            </div>
            
            {/* More Options Menu */}
            {showMoreOptions && showActions && (
                <div className="more-options-container absolute top-12 right-2 bg-white border border-black rounded-lg shadow-lg z-10 min-w-32">
                    <div className="py-1">
                        <Link
                            href={`/editor/${id}`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-black hover:bg-gray-100 transition-colors"
                        >
                            <Edit3 className="w-4 h-4" />
                        </Link>
                        {onDelete && (
                            <button
                                onClick={handleDelete}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-black hover:bg-gray-100 transition-colors w-full text-left"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}
            
            <Link href={`/editor/${id}`} className="block">
                <h3 className="font-medium text-black mb-2 line-clamp-1 hover:text-black/70 transition-colors">
                    {title}
                </h3>
                <p className="text-sm text-black/60 mb-3 line-clamp-2">
                    {preview}
                </p>
                <div className="flex items-center justify-between text-xs text-black/40">
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{lastModified}</span>
                    </div>
                    <span>{wordCount} words</span>
                </div>
            </Link>
        </div>
    )
}
