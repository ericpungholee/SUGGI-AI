'use client'
import { Folder, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface FolderSearchResult {
    id: string
    type: 'folder'
    title: string
    color: string
    lastModified: string
    count: number
}

interface FolderSearchResultsProps {
    results: FolderSearchResult[]
    isLoading: boolean
    query: string
}

export default function FolderSearchResults({ results, isLoading, query }: FolderSearchResultsProps) {
    const router = useRouter()

    const handleFolderClick = (folderId: string) => {
        router.push(`/folders/${folderId}`)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-ink/40" />
                <span className="ml-2 text-ink/60">Searching folders...</span>
            </div>
        )
    }

    if (!query) {
        return null
    }

    if (results.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-stone-light rounded-full flex items-center justify-center">
                    <Folder className="w-8 h-8 text-ink/40" />
                </div>
                <h3 className="text-lg font-medium text-ink/70 mb-2">No folders found</h3>
                <p className="text-ink/50">No folders match your search for "{query}"</p>
            </div>
        )
    }

    return (
        <div className="mb-6">
            <h2 className="text-lg font-medium text-ink/70 mb-4">
                Found {results.length} folder{results.length !== 1 ? 's' : ''} for "{query}"
            </h2>
            <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>
                {results.map((folder) => (
                    <div
                        key={folder.id}
                        className='group bg-white border border-brown-light/20 rounded-xl p-4 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer'
                        onClick={() => handleFolderClick(folder.id)}
                    >
                        <div className={`w-12 h-12 ${folder.color} rounded-lg flex items-center justify-center mb-3`}>
                            <Folder className='w-6 h-6 text-ink/60' />
                        </div>
                        <h3 className='font-medium text-ink text-sm mb-1 line-clamp-2'>
                            {folder.title}
                        </h3>
                        <p className='text-xs text-ink/40'>
                            {folder.count} item{folder.count !== 1 ? 's' : ''}
                        </p>
                        <p className='text-xs text-ink/30 mt-1'>
                            {folder.lastModified}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
