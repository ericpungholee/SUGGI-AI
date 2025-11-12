'use client'
import { FileText, MoreVertical, Bookmark, Clock, Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import DocumentCard from "@/components/ui/DocumentCard"

interface DocumentData {
    id: string
    title: string
    preview: string
    lastModified: string
    wordCount: number
    starred: boolean
}

interface DocumentGridProps {
    gridDensity?: 'compact' | 'comfortable' | 'spacious'
    showCreateButton?: boolean
}

const gridDensityClasses = {
    compact: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3',
    comfortable: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
    spacious: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
}

export default function DocumentGrid({ gridDensity = 'comfortable', showCreateButton = true }: DocumentGridProps) {
    const [documents, setDocuments] = useState<DocumentData[]>([])
    const [loading, setLoading] = useState(true)
    const [starredDocs, setStarredDocs] = useState<Set<string>>(new Set())
    const { data: session } = useSession()

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/documents')
            if (response.ok) {
                const data = await response.json()
                setDocuments(data)
                const starredIds = new Set<string>(data.filter((doc: DocumentData) => doc.starred).map((doc: DocumentData) => doc.id))
                setStarredDocs(starredIds)
            } else {
                console.error('Failed to fetch documents')
                setDocuments([])
            }
        } catch (error) {
            console.error('Error fetching documents:', error)
            setDocuments([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchDocuments()
    }, [fetchDocuments])

    const toggleStar = async (docId: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        const isCurrentlyStarred = starredDocs.has(docId)
        
        setStarredDocs(prev => {
            const newSet = new Set(prev)
            if (newSet.has(docId)) {
                newSet.delete(docId)
            } else {
                newSet.add(docId)
            }
            return newSet
        })

        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    isStarred: !isCurrentlyStarred
                })
            })

            if (!response.ok) {
                setStarredDocs(prev => {
                    const newSet = new Set(prev)
                    if (isCurrentlyStarred) {
                        newSet.add(docId)
                    } else {
                        newSet.delete(docId)
                    }
                    return newSet
                })
                console.error('Failed to update star status')
            }
        } catch (error) {
            setStarredDocs(prev => {
                const newSet = new Set(prev)
                if (isCurrentlyStarred) {
                    newSet.add(docId)
                } else {
                    newSet.delete(docId)
                }
                return newSet
            })
            console.error('Error updating star status:', error)
        }
    }

    const handleDelete = async (docId: string) => {
        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'DELETE'
            })
            if (response.ok) {
                setDocuments(prev => prev.filter(doc => doc.id !== docId))
            }
        } catch (error) {
            console.error('Error deleting document:', error)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                    <h2 className="text-lg font-semibold text-ink">All Documents</h2>
                    <div className="flex items-center gap-2">
                        {showCreateButton && (
                            <Link
                                href="/editor/new"
                                className="p-2 text-black/40 hover:text-black transition-colors"
                                title="Create Document"
                            >
                                <Plus className="w-5 h-5" />
                            </Link>
                        )}
                    </div>
                </div>
                <div className={`grid ${gridDensityClasses[gridDensity]}`}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className='bg-white border border-black rounded-xl p-5 animate-pulse'>
                            <div className='h-5 bg-gray-200 rounded mb-3'></div>
                            <div className='h-4 bg-gray-200 rounded mb-2'></div>
                            <div className='h-3 bg-gray-200 rounded'></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (documents.length === 0 && !showCreateButton) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                    <h2 className="text-lg font-semibold text-ink">All Documents</h2>
                </div>
                <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white border border-black rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-black/40" />
                    </div>
                    <h3 className="text-lg font-medium text-ink/70 mb-2">No documents yet</h3>
                    <p className="text-ink/50">Start writing to see your documents here</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                <h2 className="text-lg font-semibold text-ink">All Documents</h2>
                <div className="flex items-center gap-2">
                    {showCreateButton && (
                        <Link
                            href="/editor/new"
                            className="p-2 text-black/40 hover:text-black transition-colors"
                            title="Create Document"
                        >
                            <Plus className="w-5 h-5" />
                        </Link>
                    )}
                    <button
                        onClick={() => fetchDocuments()}
                        className="p-2 text-black/40 hover:text-black transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div className={`grid ${gridDensityClasses[gridDensity]}`}>
                {showCreateButton && (
                    <Link
                        href="/editor/new"
                        className="bg-white border-2 border-dashed border-black rounded-xl p-6 hover:border-black hover:bg-gray-50 transition-colors flex flex-col items-center justify-center min-h-[120px] group"
                    >
                        <Plus className="w-8 h-8 text-black mb-2" />
                    </Link>
                )}
                {documents.map((doc) => (
                    <DocumentCard
                        key={doc.id}
                        id={doc.id}
                        title={doc.title}
                        preview={doc.preview || ''}
                        lastModified={doc.lastModified}
                        wordCount={doc.wordCount}
                        starred={starredDocs.has(doc.id)}
                        onToggleStar={toggleStar}
                        onDelete={handleDelete}
                    />
                ))}
            </div>
        </div>
    )
}

