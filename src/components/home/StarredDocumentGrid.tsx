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
            <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className='bg-white border border-brown-light/20 rounded-xl p-5 animate-pulse'>
                        <div className='h-5 bg-gray-200 rounded mb-3'></div>
                        <div className='h-4 bg-gray-200 rounded mb-2'></div>
                        <div className='h-3 bg-gray-200 rounded'></div>
                    </div>
                ))}
            </div>
        )
    }

    if (documents.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-stone-light rounded-full flex items-center justify-center">
                    <Bookmark className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-lg font-medium text-ink/70 mb-2">No starred documents</h3>
                <p className="text-ink/50 mb-6">Star important documents to see them here</p>
                <button 
                    onClick={handleCreateDocument}
                    className="inline-flex items-center gap-2 bg-brown-medium text-white px-4 py-2 rounded-lg hover:bg-brown-dark transition-colors"
                    style={{ color: 'white' }}
                >
                    <Plus className="w-4 h-4" style={{ color: 'white' }} />
                    <span style={{ color: 'white' }}>Create Document</span>
                </button>
            </div>
        )
    }

    return (
        <div>
            {/* Header with refresh button */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-lg font-medium text-ink/70">Starred Documents</h2>
                    <p className="text-sm text-ink/50">{documents.length} important document{documents.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefresh}
                        className="p-2 hover:bg-stone-light rounded-lg transition-colors"
                        title="Refresh documents"
                    >
                        <RefreshCw className="w-4 h-4 text-ink/60" />
                    </button>
                    <button
                        onClick={handleCreateDocument}
                        className="inline-flex items-center gap-2 bg-brown-medium text-white px-3 py-2 rounded-lg hover:bg-brown-dark transition-colors text-sm"
                        style={{ color: 'white' }}
                    >
                        <Plus className="w-4 h-4" style={{ color: 'white' }} />
                        <span style={{ color: 'white' }}>New Document</span>
                    </button>
                </div>
            </div>
            
            {/* Documents grid */}
            <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                {documents.map((doc) => (
                    <div key={doc.id} className='group bg-white border border-brown-light/20 rounded-xl p-5 hover:shadow-md transition-all hover:-translate-0.5'>
                        <div className='flex items-start justify-between mb-3'>
                            <FileText className='w-5 h-5 text-brown-medium' />
                            <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                                <button
                                    onClick={(e) => toggleStar(doc.id, e)}
                                    className="p-1 hover:bg-stone-light rounded transition-colors"
                                    type="button"
                                    title="Remove from starred"
                                >
                                    <Bookmark className="w-4 h-4 fill-black text-black" />
                                </button>
                                <button
                                    onClick={handleMoreOptions}
                                    className="p-1 hover:bg-stone-light rounded transition-colors"
                                    type="button"
                                >
                                    <MoreVertical className='w-4 h-4 text-ink/40' />
                                </button>
                            </div>
                        </div>
                        
                        <Link href={`/editor/${doc.id}`} className="block">
                            <h3 className="font-medium text-ink mb-2 line-clamp-1 hover:text-brown-medium transition-colors">{doc.title}</h3>
                            <p className="text-sm text-ink/60 mb-3 line-clamp-2">{doc.preview}</p>
                            <div className="flex items-center justify-between text-xs text-ink/40">
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
