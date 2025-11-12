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
                <Loader2 className="w-6 h-6 animate-spin text-black/40" />
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
                <div className="w-16 h-16 mx-auto mb-4 bg-white border border-black rounded-full flex items-center justify-center">
                    <Folder className="w-8 h-8 text-black/40" />
                </div>
                <h3 className="text-lg font-medium text-ink/70 mb-2">No folders found</h3>
                <p className="text-ink/50">No folders match your search for "{query}"</p>
            </div>
        )
    }

    return (
        <div className="mb-6">
            <div className="flex items-center justify-between border-b border-black pb-4 mb-6">
                <h2 className="text-lg font-semibold text-ink">
                    Found {results.length} folder{results.length !== 1 ? 's' : ''} for "{query}"
                </h2>
            </div>
            <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>
                {results.map((folder) => (
                    <div
                        key={folder.id}
                        className='group bg-white border border-black rounded-xl p-4 hover:bg-gray-50 transition-all cursor-pointer'
                        onClick={() => handleFolderClick(folder.id)}
                    >
                        <div className="w-12 h-12 bg-white border border-black rounded-lg flex items-center justify-center mb-3">
                            <Folder className='w-6 h-6 text-black' />
                        </div>
                        <h3 className='font-medium text-black text-sm mb-1 line-clamp-2 group-hover:text-black/70 transition-colors'>
                            {folder.title}
                        </h3>
                        <p className='text-xs text-black/40'>
                            {folder.count} item{folder.count !== 1 ? 's' : ''}
                        </p>
                        <p className='text-xs text-black/30 mt-1'>
                            {folder.lastModified}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
