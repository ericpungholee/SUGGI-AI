'use client'
import { Folder, MoreVertical, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Folder {
    id: string;
    name: string;
    count: number;
    color: string;
}

export default function FolderGrid() {
    const [folders, setFolders] = useState<Folder[]>([])
    const [loading, setLoading] = useState(true)
    const { data: session } = useSession()

    useEffect(() => {
        fetchFolders()
    }, [])

    const fetchFolders = async () => {
        try {
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
    }

    const handleMoreOptions = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        // Handle more options logic here
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

    if (folders.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-stone-light rounded-full flex items-center justify-center">
                    <Folder className="w-8 h-8 text-ink/40" />
                </div>
                <h3 className="text-lg font-medium text-ink/70 mb-2">No folders yet</h3>
                <p className="text-ink/50 mb-6">Create your first folder to organize your documents</p>
                <button 
                    className="inline-flex items-center gap-2 bg-brown-medium text-white px-4 py-2 rounded-lg hover:bg-brown-dark transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create Folder
                </button>
            </div>
        )
    }

    return (
        <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>
            {folders.map((folder) => (
                <div
                key={folder.id}
                className='group relative bg-white border border-brown-light/20 rounded-xl p-4 hover:shadow-md transition-all hover:-translate-0.5 cursor-pointer'
                >
                    <button 
                        className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-stone-light rounded'
                        onClick={handleMoreOptions}
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
    )
}