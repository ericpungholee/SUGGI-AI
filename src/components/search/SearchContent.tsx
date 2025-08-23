'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, FileText, Folder, Clock, Star, X } from 'lucide-react'
import Link from 'next/link'

interface SearchResult {
    id: string
    type: 'document' | 'folder'
    title: string
    preview?: string
    lastModified?: string
    wordCount?: number
    starred?: boolean
}

export default function SearchContent() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [loading, setLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const searchParams = useSearchParams()
    const router = useRouter()

    // Initialize search from URL params
    useEffect(() => {
        const q = searchParams.get('q')
        if (q) {
            setQuery(q)
            performSearch(q)
        }
    }, [searchParams])

    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([])
            setHasSearched(false)
            return
        }

        setLoading(true)
        setHasSearched(true)

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
            if (response.ok) {
                const data = await response.json()
                setResults(data)
            } else {
                console.error('Search failed')
                setResults([])
            }
        } catch (error) {
            console.error('Search error:', error)
            setResults([])
        } finally {
            setLoading(false)
        }
    }, [])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query.trim())}`)
        }
    }

    const clearSearch = () => {
        setQuery('')
        setResults([])
        setHasSearched(false)
        router.push('/search')
    }

    const getResultIcon = (result: SearchResult) => {
        if (result.type === 'document') {
            return <FileText className="w-5 h-5 text-brown-medium" />
        } else {
            return <Folder className="w-5 h-5 text-blue-600" />
        }
    }

    const getResultLink = (result: SearchResult) => {
        if (result.type === 'document') {
            return `/editor/${result.id}`
        } else {
            return `/folders/${result.id}`
        }
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Search Input */}
            <form onSubmit={handleSearch} className="mb-8">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search documents, folders, and content..."
                        className="w-full pl-12 pr-12 py-4 bg-white border border-brown-light/20 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-brown-light/30"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={clearSearch}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-light rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-ink/40" />
                        </button>
                    )}
                </div>
            </form>

            {/* Search Results */}
            {loading && (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brown-medium mx-auto mb-4"></div>
                    <p className="text-ink/60">Searching...</p>
                </div>
            )}

            {!loading && hasSearched && (
                <div>
                    {results.length > 0 ? (
                        <div>
                            <div className="mb-4">
                                <h2 className="text-lg font-medium text-ink/70">
                                    {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
                                </h2>
                            </div>
                            
                            <div className="space-y-3">
                                {results.map((result) => (
                                    <Link
                                        key={`${result.type}-${result.id}`}
                                        href={getResultLink(result)}
                                        className="block bg-white border border-brown-light/20 rounded-xl p-4 hover:shadow-md transition-all hover:-translate-0.5"
                                    >
                                        <div className="flex items-start gap-3">
                                            {getResultIcon(result)}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-ink mb-1 line-clamp-1">
                                                    {result.title}
                                                </h3>
                                                {result.preview && (
                                                    <p className="text-sm text-ink/60 mb-2 line-clamp-2">
                                                        {result.preview}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-4 text-xs text-ink/40">
                                                    {result.lastModified && (
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            <span>{result.lastModified}</span>
                                                        </div>
                                                    )}
                                                    {result.wordCount && (
                                                        <span>{result.wordCount} words</span>
                                                    )}
                                                    {result.starred && (
                                                        <div className="flex items-center gap-1">
                                                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                                            <span>Starred</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-4 bg-stone-light rounded-full flex items-center justify-center">
                                <Search className="w-8 h-8 text-ink/40" />
                            </div>
                            <h3 className="text-lg font-medium text-ink/70 mb-2">No results found</h3>
                            <p className="text-ink/50 mb-6">
                                No documents or folders match "{query}". Try different keywords.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {!hasSearched && !loading && (
                <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-stone-light rounded-full flex items-center justify-center">
                        <Search className="w-8 h-8 text-ink/40" />
                    </div>
                    <h3 className="text-lg font-medium text-ink/70 mb-2">Start searching</h3>
                    <p className="text-ink/50 mb-6">
                        Enter keywords to search through your documents and folders
                    </p>
                </div>
            )}
        </div>
    )
}
