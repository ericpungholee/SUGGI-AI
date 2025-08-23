'use client'
import { Folder, MoreVertical } from "lucide-react";
import { useState, useEffect } from "react";

const folders = [
    { id: 1, name: 'Personal Writing', count: 12, color: 'bg-blue-100' },
    { id: 2, name: 'Work Documents', count: 8, color: 'bg-green-100' },
    { id: 3, name: 'Creative Projects', count: 5, color: 'bg-purple-100' },
    { id: 4, name: 'Notes & Ideas', count: 23, color: 'bg-amber-100' },
]

export default function FolderGrid() {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleMoreOptions = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        // Handle more options logic here
    }

    if (!mounted) {
        return (
            <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>
                {folders.map((folder) => (
                    <div
                    key={folder.id}
                    className='group relative bg-white border border-brown-light/20 rounded-xl p-4 hover:shadow-md transition-all hover:-translate-0.5 cursor-pointer'
                    >
                        <div className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded'>
                            <MoreVertical className='w-4 h-4 text-ink/40' />
                        </div>
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