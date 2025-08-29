'use client'
import { Folder, MoreVertical, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import CreateFolderModal from "./CreateFolderModal";
import FolderOptionsModal from "./FolderOptionsModal";

interface Folder {
    id: string;
    name: string;
    count: number;
    color: string;
    icon?: string;
}

interface FolderGridProps {
    showCreateButton?: boolean;
}

export default function FolderGrid({ showCreateButton = true }: FolderGridProps) {
    const [folders, setFolders] = useState<Folder[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showOptionsModal, setShowOptionsModal] = useState(false)
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
    const { data: session } = useSession()
    const router = useRouter()

    useEffect(() => {
        if (session?.user) {
            fetchFolders()
        }
    }, [session])

    const fetchFolders = async () => {
        try {
            setLoading(true)
            setError(null)
            
            const response = await fetch('/api/folders')
            if (response.ok) {
                const data = await response.json()
                setFolders(data)
            } else {
                const errorData = await response.json()
                setError(errorData.error || 'Failed to fetch folders')
                setFolders([])
            }
        } catch (error) {
            setError('Network error occurred')
            setFolders([])
        } finally {
            setLoading(false)
        }
    }

    const handleCreateFolder = () => {
        setShowCreateModal(true)
    }

    const handleFolderCreated = () => {
        fetchFolders()
    }

    const handleMoreOptions = (e: React.MouseEvent, folder: Folder) => {
        e.preventDefault()
        e.stopPropagation()
        setSelectedFolder(folder)
        setShowOptionsModal(true)
    }

    const handleFolderClick = (folder: Folder) => {
        router.push(`/folders/${folder.id}`)
    }

    const handleFolderUpdated = () => {
        fetchFolders()
    }

    const handleRetry = () => {
        fetchFolders()
    }

    if (loading) {
        return (
            <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className='bg-white border border-brown-light/20 rounded-xl p-4 animate-pulse'>
                        <div className='w-12 h-12 bg-gray-200 rounded-lg mb-3'></div>
                        <div className='h-4 bg-gray-200 rounded mb-2'></div>
                        <div className='h-3 bg-gray-200 rounded'></div>
                    </div>
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <Folder className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-ink/70 mb-2">Error loading folders</h3>
                <p className="text-ink/50 mb-6">{error}</p>
                <button 
                    onClick={handleRetry}
                    className="inline-flex items-center gap-2 bg-brown-medium text-white px-4 py-2 rounded-lg hover:bg-brown-dark transition-colors"
                    style={{ color: 'white' }}
                >
                    <Plus className="w-4 h-4" style={{ color: 'white' }} />
                    <span style={{ color: 'white' }}>Retry</span>
                </button>
            </div>
        )
    }

    if (folders.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-stone-light rounded-full flex items-center justify-center">
                    <Folder className="w-8 h-8 text-ink/40" />
                </div>
                <h3 className="text-lg font-medium text-ink/70 mb-2">No folders yet</h3>
                <p className="text-ink/50 mb-6">Create your first folder to organize your documents</p>
                <button 
                    onClick={handleCreateFolder}
                    className="inline-flex items-center justify-center bg-white w-12 h-12 rounded-lg hover:bg-gray-100 transition-colors shadow-sm border border-gray-200"
                    title="Create Folder"
                    style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}
                >
                    <Plus className="w-6 h-6 text-black" style={{ color: 'black' }} />
                </button>
            </div>
        )
    }

    return (
        <>
            {showCreateButton && (
                <div className="mb-6 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-ink">Your Folders</h2>
                    <button
                        onClick={handleCreateFolder}
                        className="inline-flex items-center justify-center bg-white w-12 h-12 rounded-lg hover:bg-gray-100 transition-colors shadow-sm border border-gray-200"
                        title="Create New Folder"
                        style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}
                    >
                        <Plus className="w-6 h-6 text-black" style={{ color: 'black' }} />
                    </button>
                </div>
            )}
            
            <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>
                {folders.map((folder) => (
                    <div
                        key={folder.id}
                        className='group relative bg-white border border-brown-light/20 rounded-xl p-4 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer'
                        onClick={() => handleFolderClick(folder)}
                    >
                        <button 
                            className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-stone-light rounded'
                            onClick={(e) => handleMoreOptions(e, folder)}
                            type="button"
                        >
                            <MoreVertical className='w-4 h-4 text-ink/40' />
                        </button>
                        <div className={`w-12 h-12 ${folder.color} rounded-lg flex items-center justify-center mb-3`}>
                            <Folder className='w-6 h-6 text-ink/60' />
                        </div>
                        <h3 className='font-medium text-ink text-sm mb-1 line-clamp-2'>{folder.name}</h3>
                        <p className='text-xs text-ink/40'>{folder.count} items</p>
                    </div>
                ))}
            </div>

            {/* Create Folder Modal */}
            <CreateFolderModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onFolderCreated={handleFolderCreated}
            />

            {/* Folder Options Modal */}
            <FolderOptionsModal
                isOpen={showOptionsModal}
                onClose={() => setShowOptionsModal(false)}
                folder={selectedFolder}
                onFolderUpdated={handleFolderUpdated}
            />
        </>
    )
}