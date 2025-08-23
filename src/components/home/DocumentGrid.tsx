'use client'
import { FileText, MoreVertical, Star, Clock } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

const documents = [
    {
        id: 1,
        title: 'Morning Reflections',
        preview: 'The sun rises slowly over the mountains, painting the sky in hues of gold and amber...',
        lastModified: '2 hours ago',
        wordCount: 1234,
        starred: true,
    },
    {
        id: 2,
        title: 'Project Proposal Draft',
        preview: 'Executive Summary: This proposal outlines our strategic approach to implementing...',
        lastModified: 'Yesterday',
        wordCount: 3456,
        starred: false,
    },
    {
        id: 3,
        title: 'Recipe Collection',
        preview: 'Grandma\'s famous apple pie recipe, passed down through generations...',
        lastModified: '3 days ago',
        wordCount: 892,
        starred: false,
    },
    {
        id: 4,
        title: 'Meeting Notes - Q4 Planning',
        preview: 'Attendees: Sarah, Michael, Jennifer. Key objectives for the quarter include...',
        lastModified: 'Last week',
        wordCount: 567,
        starred: true,
    },
]

export default function DocumentGrid() {
    const [mounted, setMounted] = useState(false)
    const [starredDocs, setStarredDocs] = useState<Set<number>>(
        new Set(documents.filter(doc => doc.starred).map(doc => doc.id))
    )

    useEffect(() => {
        setMounted(true)
    }, [])

    const toggleStar = (docId: number, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setStarredDocs(prev => {
            const newSet = new Set(prev)
            if (newSet.has(docId)) {
                newSet.delete(docId)
            } else {
                newSet.add(docId)
            }
            return newSet
        })
    }

    const handleMoreOptions = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        // Handle more options logic here
    }

    if (!mounted) {
        return (
            <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                {documents.map((doc) => (
                    <div key={doc.id} className='group bg-white border border-brown-light/20 rounded-xl p-5 hover:shadow-md transition-all hover:-translate-0.5'>
                        <div className='flex items-start justify-between mb-3'>
                            <FileText className='w-5 h-5 text-brown-medium' />
                            <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                                <div className="p-1 rounded">
                                    <Star className={`w-4 h-4 ${doc.starred ? 'fill-amber-400 text-amber-400' : 'text-ink/40'}`} />
                                </div>
                                <div className="p-1 rounded">
                                    <MoreVertical className='w-4 h-4 text-ink/40' />
                                </div>
                            </div>
                        </div>
                        
                        <div className="block">
                            <h3 className="font-medium text-ink mb-2 line-clamp-1">{doc.title}</h3>
                            <p className="text-sm text-ink/60 mb-3 line-clamp-2">{doc.preview}</p>
                            <div className="flex items-center justify-between text-xs text-ink/40">
                                <div className="flex items-center gap-1">
                                    <Clock className='w-3 h-3' />
                                    <span>{doc.lastModified}</span>
                                </div>
                                <span>{doc.wordCount} words</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
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
                            >
                                <Star className={`w-4 h-4 ${starredDocs.has(doc.id) ? 'fill-amber-400 text-amber-400' : 'text-ink/40'}`} />
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
    )
}