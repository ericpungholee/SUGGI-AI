'use client'
import { FileText, Folder, Clock, Bookmark, Search, X } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface SearchResult {
    id: string
    type: 'document' | 'folder'
    title: string
    preview?: string
    lastModified: string
    wordCount?: number
    starred?: boolean
}

interface SearchResultsProps {
    results: SearchResult[]
    query: string
    isLoading: boolean
    onClose: () => void
}

export default function SearchResults({ results, query, isLoading, onClose }: SearchResultsProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return null
    }

    if (isLoading) {
        return (
            <div className="mb-6 bg-white border border-black rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Search className="w-5 h-5 text-black" />
                    <h3 className="text-lg font-medium text-ink">Searching...</h3>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-white border border-black rounded-xl p-4 animate-pulse">
                            <div className="w-8 h-8 bg-gray-200 rounded-lg mb-3"></div>
                            <div className="h-4 bg-gray-200 rounded mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (results.length === 0 && query) {
        return (
            <div className="mb-6 bg-white border border-black rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Search className="w-5 h-5 text-black" />
                    <h3 className="text-lg font-medium text-ink">No results found</h3>
                </div>
                <p className="text-ink/60">
                    No documents or folders found matching "{query}". Try different keywords.
                </p>
            </div>
        )
    }

    if (results.length === 0) {
        return null
    }

    const documents = results.filter(result => result.type === 'document')
    const folders = results.filter(result => result.type === 'folder')

    return (
        <div className="mb-6 bg-white border border-black rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-black" />
                    <h3 className="text-lg font-medium text-ink">
                        Search Results for "{query}"
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="text-black/40 hover:text-black transition-colors p-1"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Documents Results */}
            {documents.length > 0 && (
                <div className="mb-6">
                    <h4 className="text-sm font-medium text-ink/70 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Documents ({documents.length})
                    </h4>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {documents.map((doc) => (
                            <Link
                                key={doc.id}
                                href={`/editor/${doc.id}`}
                                className="group relative bg-white border border-black rounded-xl p-5 hover:bg-gray-50 transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <FileText className="w-5 h-5 text-black" />
                                    {doc.starred && (
                                        <Bookmark className="w-4 h-4 fill-black text-black" />
                                    )}
                                </div>
                                <h5 className="font-medium text-black mb-2 line-clamp-1 group-hover:text-black/70 transition-colors">
                                    {doc.title}
                                </h5>
                                {doc.preview && (
                                    <p className="text-sm text-black/60 mb-3 line-clamp-2">
                                        {doc.preview}
                                    </p>
                                )}
                                <div className="flex items-center justify-between text-xs text-black/40">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{doc.lastModified}</span>
                                    </div>
                                    {doc.wordCount && (
                                        <span>{doc.wordCount} words</span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Folders Results */}
            {folders.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-ink/70 mb-3 flex items-center gap-2">
                        <Folder className="w-4 h-4" />
                        Folders ({folders.length})
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {folders.map((folder) => (
                            <Link
                                key={folder.id}
                                href={`/folders/${folder.id}`}
                                className="group bg-white border border-black rounded-xl p-4 hover:bg-gray-50 transition-all"
                            >
                                <div className="w-12 h-12 bg-white border border-black rounded-lg flex items-center justify-center mb-3">
                                    <Folder className="w-6 h-6 text-black" />
                                </div>
                                <h5 className="font-medium text-black text-sm mb-1 line-clamp-2 group-hover:text-black/70 transition-colors">
                                    {folder.title}
                                </h5>
                                <div className="flex items-center gap-1 text-xs text-black/40">
                                    <Clock className="w-3 h-3" />
                                    <span>{folder.lastModified}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
