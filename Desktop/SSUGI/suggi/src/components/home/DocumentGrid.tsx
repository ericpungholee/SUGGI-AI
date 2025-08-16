'use client'
import { FileText, MoreVertical, Star, Clock } from "lucide-react"
import Link from "next/link"


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
    },]



export default function DocumentGrid() {
    return (
        <div className='grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
            {documents.map((doc) => (
                <Link href={`/editor/${doc.id}`} key={doc.id} className='group bg-white border border-brown-light/20 rounded-xl p-5 hover:shadow-md transition-all hover:-translate-0.5'>
                    <div className='flex items-start justify-between mb-3'>
                        <FileText className='w-5 h-5 text-brown-medium' />
                        <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                            <button
                                onClick={(e) => {
                                    e.preventDefault
                                }}
                                className="p-1 hover:bg-stone-light rounded"
                            >
                                <Star className={`w-4 h-4 ${doc.starred ? 'fill-amber-400' : 'text-i k/40'}`} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.preventDefault
                                }}
                                className="p-1 hover:bg-stone-light rounded"
                            >
                                <MoreVertical className='w-4 h-4 text-ink/40' />
                            </button>
                        </div>
                    </div>
                    <h3 className="font-medium text-ink mb-2 line-clamp-1">{doc.title}</h3>
                    <p className="text-sm text-ink/60 mb-3 line-clamp-2">{doc.preview}</p>
                    <div className="flex items-center justify-between text-xs text-ink/40">
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{doc.lastModified}</span>
                        </div>
                        <span>{doc.wordCount} words</span>
                    </div>

                </Link>
            ))}

        </div>
    )
}