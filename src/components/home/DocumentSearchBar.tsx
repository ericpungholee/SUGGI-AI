'use client'
import { Search, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface DocumentSearchBarProps {
    onSearch: (query: string) => void
    onClear: () => void
    placeholder?: string
}

export default function DocumentSearchBar({ onSearch, onClear, placeholder = "Search documents..." }: DocumentSearchBarProps) {
    const [query, setQuery] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim()) {
            onSearch(query.trim())
        }
    }

    const handleClear = () => {
        setQuery('')
        onClear()
        inputRef.current?.focus()
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setQuery(value)
        
        // Clear results if input is empty
        if (value.trim() === '') {
            onClear()
        }
    }

    // Handle escape key to clear search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && query) {
                handleClear()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [query])

    return (
        <div className="mb-6">
            <form onSubmit={handleSubmit} className="relative max-w-md">
                <div className="relative transition-all duration-200">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-black/40" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleInputChange}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder={placeholder}
                        className="w-full pl-12 pr-12 py-3 bg-white border border-black rounded-xl text-sm focus:outline-none focus:ring-0 focus:border-black transition-all duration-200"
                        style={{ outline: 'none' }}
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 text-black" />
                        </button>
                    )}
                </div>
            </form>
        </div>
    )
}
