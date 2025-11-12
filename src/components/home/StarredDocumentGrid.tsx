'use client'
import { FileText, MoreVertical, Bookmark, Clock, Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"

interface Document {
    id: string
    title: string
    preview: string
    lastModified: string
    wordCount: number
    starred: boolean
}

export default function StarredDocumentGrid() {
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [starredDocs, setStarredDocs] = useState<Set<string>>(new Set())
    const { data: session } = useSession()

    const fetchStarredDocuments = useCallback(async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/documents?starred=true')
            if (response.ok) {
                const data = await response.json()
                setDocuments(data)
                // Initialize starred state from fetched data
                const starredIds = new Set<string>(data.filter((doc: Document) => doc.starred).map((doc: Document) => doc.id as string))
                setStarredDocs(starredIds)
            } else {
                console.error('Failed to fetch starred documents')
                setDocuments([])
            }
        } catch (error) {
            console.error('Error fetching starred documents:', error)
            setDocuments([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStarredDocuments()
    }, [fetchStarredDocuments])

    const toggleStar = async (docId: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        const isCurrentlyStarred = starredDocs.has(docId)
        
        // Optimistically update UI
        setStarredDocs(prev => {
            const newSet = new Set(prev)
            if (newSet.has(docId)) {
                newSet.delete(docId)
            } else {
                newSet.add(docId)
            }
            return newSet
        })

        // Update star status in database via API
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
                // Revert optimistic update on error
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
            } else {
                // Refresh the list since this is a starred-only view
                fetchStarredDocuments()
            }
        } catch (error) {
            // Revert optimistic update on error
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

    const handleMoreOptions = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        // Handle more options logic here
    }

    const handleCreateDocument = () => {
        // Navigate to new document page
        window.location.href = '/editor/new'
    }

    const handleRefresh = () => {
        fetchStarredDocuments()
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                    <h2 className="text-lg font-semibold text-ink">Starred Documents</h2>
                </div>
                <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                    {[...Array(4)].map((_, i) => (
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

    if (documents.length === 0) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                    <h2 className="text-lg font-semibold text-ink">Starred Documents</h2>
                </div>
                <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white border border-black rounded-full flex items-center justify-center">
                        <Bookmark className="w-8 h-8 text-black/40" />
                    </div>
                    <h3 className="text-lg font-medium text-ink/70 mb-2">No starred documents</h3>
                    <p className="text-ink/50 mb-6">Star important documents to see them here</p>
                    <button 
                        onClick={handleCreateDocument}
                        className="inline-flex items-center justify-center p-2 border border-black rounded-lg hover:bg-gray-100 transition-colors"
                        title="Create Document"
                    >
                        <Plus className="w-5 h-5 text-black" />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-ink">Starred Documents</h2>
                    <p className="text-sm text-ink/50">{documents.length} important document{documents.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefresh}
                        className="p-2 text-black/40 hover:text-black transition-colors"
                        title="Refresh documents"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleCreateDocument}
                        className="p-2 text-black/40 hover:text-black transition-colors"
                        title="Create Document"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            {/* Documents grid */}
            <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                {documents.map((doc) => (
                    <div key={doc.id} className='group bg-white border border-black rounded-xl p-5 hover:bg-gray-50 transition-all'>
                        <div className='flex items-start justify-between mb-3'>
                            <FileText className='w-5 h-5 text-black' />
                            <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                                <button
                                    onClick={(e) => toggleStar(doc.id, e)}
                                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                                    type="button"
                                    title="Remove from starred"
                                >
                                    <Bookmark className="w-4 h-4 fill-black text-black" />
                                </button>
                                <button
                                    onClick={handleMoreOptions}
                                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                                    type="button"
                                >
                                    <MoreVertical className='w-4 h-4 text-black' />
                                </button>
                            </div>
                        </div>
                        
                        <Link href={`/editor/${doc.id}`} className="block">
                            <h3 className="font-medium text-black mb-2 line-clamp-1 hover:text-black/70 transition-colors">{doc.title}</h3>
                            <p className="text-sm text-black/60 mb-3 line-clamp-2">{doc.preview}</p>
                            <div className="flex items-center justify-between text-xs text-black/40">
                                <div className="flex items-center gap-1">
                                    <Clock className='w-3 h-3' />
                                    <span>{doc.lastModified}</span>
                                </div>
                                <span>{doc.wordCount} words</span>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    )
}
