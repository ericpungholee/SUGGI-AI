'use client'
import { useState, useCallback, useRef } from 'react'

interface SearchResult {
    id: string
    type: 'document' | 'folder'
    title: string
    preview?: string
    lastModified: string
    wordCount?: number
    starred?: boolean
}

export function useSearch() {
    const [results, setResults] = useState<SearchResult[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [query, setQuery] = useState('')
    const [hasSearched, setHasSearched] = useState(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    const search = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([])
            setQuery('')
            setHasSearched(false)
            return
        }

        // Cancel previous request if it exists
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController()

        try {
            setIsLoading(true)
            setQuery(searchQuery)
            setHasSearched(true)

            const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
                signal: abortControllerRef.current.signal
            })

            if (!response.ok) {
                throw new Error('Search failed')
            }

            const data = await response.json()
            setResults(data)
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // Request was cancelled, ignore
                return
            }
            console.error('Search error:', error)
            setResults([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    const clearSearch = useCallback(() => {
        // Cancel any ongoing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        
        setResults([])
        setQuery('')
        setHasSearched(false)
        setIsLoading(false)
    }, [])

    return {
        results,
        isLoading,
        query,
        hasSearched,
        search,
        clearSearch
    }
}
