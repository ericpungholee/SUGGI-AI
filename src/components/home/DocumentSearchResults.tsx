'use client'
import { FileText, Clock, Bookmark, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface DocumentSearchResult {
    id: string
    type: 'document'
    title: string
    preview: string
    lastModified: string
    wordCount: number
    starred: boolean
}

interface DocumentSearchResultsProps {
    results: DocumentSearchResult[]
    isLoading: boolean
    query: string
}

export default function DocumentSearchResults({ results, isLoading, query }: DocumentSearchResultsProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-black/40" />
                <span className="ml-2 text-ink/60">Searching documents...</span>
            </div>
        )
    }

    if (!query) {
        return null
    }

    if (results.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-white border border-black rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-black/40" />
                </div>
                <h3 className="text-lg font-medium text-ink/70 mb-2">No documents found</h3>
                <p className="text-ink/50">No documents match your search for "{query}"</p>
            </div>
        )
    }

    return (
        <div className="mb-6">
            <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                <h2 className="text-lg font-semibold text-ink">
                    Found {results.length} document{results.length !== 1 ? 's' : ''} for "{query}"
                </h2>
            </div>
            <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                {results.map((doc) => (
                    <Link key={doc.id} href={`/editor/${doc.id}`} className="block">
                        <div className='group bg-white border border-black rounded-xl p-5 hover:bg-gray-50 transition-all'>
                            <div className='flex items-start justify-between mb-3'>
                                <FileText className='w-5 h-5 text-black' />
                                <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                                    {doc.starred && (
                                        <Bookmark className="w-4 h-4 fill-black text-black" />
                                    )}
                                </div>
                            </div>
                            
                            <h3 className="font-medium text-black mb-2 line-clamp-1 hover:text-black/70 transition-colors">
                                {doc.title}
                            </h3>
                            <p className="text-sm text-black/60 mb-3 line-clamp-2">
                                {doc.preview}
                            </p>
                            <div className="flex items-center justify-between text-xs text-black/40">
                                <div className="flex items-center gap-1">
                                    <Clock className='w-3 h-3' />
                                    <span>{doc.lastModified}</span>
                                </div>
                                <span>{doc.wordCount} words</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
