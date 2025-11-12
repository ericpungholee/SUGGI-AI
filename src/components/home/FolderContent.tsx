'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Bookmark, Clock, MoreVertical, X } from 'lucide-react'
import AddDocumentsModal from './AddDocumentsModal'

interface DocumentData {
    id: string
    title: string
    preview: string
    lastModified: string
    wordCount: number
    starred: boolean
    folderId?: string
}

interface FolderContentProps {
    folderId: string
}

export default function FolderContent({ folderId }: FolderContentProps) {
    const [documents, setDocuments] = useState<DocumentData[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [starredDocs, setStarredDocs] = useState<Set<string>>(new Set())
    const router = useRouter()

    useEffect(() => {
        fetchFolderContent()
    }, [folderId])

    const fetchFolderContent = async () => {
        try {
            setLoading(true)
            
            // Fetch documents in this folder
            const docsResponse = await fetch(`/api/documents?folderId=${folderId}`)
            if (docsResponse.ok) {
                const docsData = await docsResponse.json()
                setDocuments(docsData)
                // Initialize starred state from fetched data
                const starredIds = new Set<string>(docsData.filter((doc: DocumentData) => doc.starred).map((doc: DocumentData) => doc.id))
                setStarredDocs(starredIds)
            }
        } catch (error) {
            console.error('Error fetching folder content:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDocumentClick = (documentId: string) => {
        router.push(`/editor/${documentId}`)
    }

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

    const handleAddExistingDocument = () => {
        setShowAddModal(true)
    }

    const handleDocumentsAdded = () => {
        fetchFolderContent()
    }

    const handleRemoveDocument = async (documentId: string) => {
        try {
            const response = await fetch('/api/documents', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentIds: [documentId],
                    action: 'remove'
                })
            })

            if (response.ok) {
                // Remove the document from the local state
                setDocuments(prev => prev.filter(doc => doc.id !== documentId))
            } else {
                console.error('Failed to remove document from folder')
            }
        } catch (error) {
            console.error('Error removing document from folder:', error)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-black pb-4 mb-6">
                    <h2 className="text-lg font-semibold text-ink">Contents</h2>
                    <div className="w-9 h-9 bg-gray-200 rounded-lg animate-pulse"></div>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-white border border-black rounded-xl p-5 animate-pulse">
                            <div className="w-12 h-12 bg-gray-200 rounded-lg mb-3"></div>
                            <div className="h-4 bg-gray-200 rounded mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header with actions */}
                <div className="flex justify-between items-center border-b border-black pb-4 mb-6">
                    <h2 className="text-lg font-semibold text-ink">
                        Contents ({documents.length} documents)
                    </h2>
                    <button
                        onClick={handleAddExistingDocument}
                        className="p-2 text-black/40 hover:text-black transition-colors"
                        title="Add Document"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                {/* Documents */}
                {documents.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {documents.map((doc) => (
                            <div
                                key={doc.id}
                                className="group relative bg-white border border-black rounded-xl p-5 hover:bg-gray-50 transition-all"
                            >
                                {/* Action buttons */}
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => toggleStar(doc.id, e)}
                                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                                            title={starredDocs.has(doc.id) ? "Remove from starred" : "Add to starred"}
                                        >
                                            <Bookmark className={`w-4 h-4 ${starredDocs.has(doc.id) ? 'fill-black text-black' : 'text-black/40'}`} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                // For now, just remove the document directly
                                                // In the future, this could open a dropdown menu
                                                handleRemoveDocument(doc.id)
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                                            title="Remove from folder"
                                        >
                                            <X className="w-4 h-4 text-black" />
                                        </button>
                                    </div>
                                </div>

                                {/* Document content - clickable */}
                                <div 
                                    className="cursor-pointer"
                                    onClick={() => handleDocumentClick(doc.id)}
                                >
                                    <div className="w-12 h-12 bg-white border border-black rounded-lg flex items-center justify-center mb-3">
                                        <FileText className="w-6 h-6 text-black" />
                                    </div>
                                    <h4 className="font-medium text-black mb-2 line-clamp-1 hover:text-black/70 transition-colors">{doc.title}</h4>
                                    <p className="text-sm text-black/60 mb-3 line-clamp-2">{doc.preview}</p>
                                    <div className="flex items-center justify-between text-xs text-black/40">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{doc.lastModified}</span>
                                        </div>
                                        <span>{doc.wordCount} words</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 bg-white border border-black rounded-full flex items-center justify-center">
                            <FileText className="w-8 h-8 text-black/40" />
                        </div>
                        <h3 className="text-lg font-medium text-ink/70 mb-2">This folder is empty</h3>
                        <p className="text-ink/50 mb-6">Add existing documents to get started</p>
                        <button
                            onClick={handleAddExistingDocument}
                            className="inline-flex items-center justify-center p-2 border border-black rounded-lg hover:bg-gray-100 transition-colors"
                            title="Add Document"
                        >
                            <Plus className="w-5 h-5 text-black" />
                        </button>
                    </div>
                )}
            </div>

            {/* Add Documents Modal */}
            <AddDocumentsModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                folderId={folderId}
                onDocumentsAdded={handleDocumentsAdded}
            />
        </>
    )
}
