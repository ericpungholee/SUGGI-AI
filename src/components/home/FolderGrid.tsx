'use client'
import { Folder, MoreVertical, Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"

interface FolderData {
    id: string
    name: string
    icon?: string
    documentCount?: number
    lastModified: string
}

interface FolderGridProps {
    gridDensity?: 'compact' | 'comfortable' | 'spacious'
    showCreateButton?: boolean
}

const gridDensityClasses = {
    compact: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3',
    comfortable: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
    spacious: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
}

export default function FolderGrid({ gridDensity = 'comfortable', showCreateButton = true }: FolderGridProps) {
    const [folders, setFolders] = useState<FolderData[]>([])
    const [loading, setLoading] = useState(true)
    const { data: session } = useSession()

    const fetchFolders = useCallback(async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/folders')
            if (response.ok) {
                const data = await response.json()
                setFolders(data)
            } else {
                console.error('Failed to fetch folders')
                setFolders([])
            }
        } catch (error) {
            console.error('Error fetching folders:', error)
            setFolders([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchFolders()
    }, [fetchFolders])

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                    <h2 className="text-lg font-semibold text-ink">Folders</h2>
                </div>
                <div className={`grid ${gridDensityClasses[gridDensity]}`}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className='bg-white border border-black rounded-xl p-5 animate-pulse'>
                            <div className='h-5 bg-gray-200 rounded mb-3'></div>
                            <div className='h-4 bg-gray-200 rounded'></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (folders.length === 0 && !showCreateButton) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                    <h2 className="text-lg font-semibold text-ink">Folders</h2>
                </div>
                <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white border border-black rounded-full flex items-center justify-center">
                        <Folder className="w-8 h-8 text-black/40" />
                    </div>
                    <h3 className="text-lg font-medium text-ink/70 mb-2">No folders yet</h3>
                    <p className="text-ink/50">Create a folder to organize your documents</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                <h2 className="text-lg font-semibold text-ink">Folders</h2>
                <div className="flex items-center gap-2">
                    {showCreateButton && (
                        <Link
                            href="/folders"
                            className="p-2 text-black/40 hover:text-black transition-colors"
                            title="Create Folder"
                        >
                            <Plus className="w-5 h-5" />
                        </Link>
                    )}
                    <button
                        onClick={() => fetchFolders()}
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
                        href="/folders"
                        className="bg-white border-2 border-dashed border-black rounded-xl p-6 hover:border-black hover:bg-gray-50 transition-colors flex flex-col items-center justify-center min-h-[120px] group"
                    >
                        <Plus className="w-8 h-8 text-black mb-2" />
                    </Link>
                )}
                {folders.map((folder) => (
                    <Link
                        key={folder.id}
                        href={`/folders/${folder.id}`}
                        className="bg-white border border-black rounded-xl p-5 hover:bg-gray-50 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-lg border border-black flex items-center justify-center flex-shrink-0">
                                    <Folder className="w-5 h-5 text-black" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-ink truncate group-hover:text-black/70 transition-colors">
                                        {folder.name}
                                    </h3>
                                    {folder.documentCount !== undefined && (
                                        <p className="text-xs text-ink/60 mt-1">
                                            {folder.documentCount} {folder.documentCount === 1 ? 'document' : 'documents'}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
                            >
                                <MoreVertical className="w-4 h-4 text-black" />
                            </button>
                        </div>
                        {folder.lastModified && (
                            <p className="text-xs text-ink/50">
                                Modified {new Date(folder.lastModified).toLocaleDateString()}
                            </p>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    )
}

