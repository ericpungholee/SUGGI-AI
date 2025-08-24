import Link from 'next/link'
import { Folder, ArrowLeft } from 'lucide-react'

export default function FolderNotFound() {
    return (
        <div className="min-h-screen bg-stone-light flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 bg-stone-light rounded-full flex items-center justify-center">
                    <Folder className="w-10 h-10 text-ink/40" />
                </div>
                
                <h1 className="text-2xl font-bold text-ink mb-3">Folder Not Found</h1>
                
                <p className="text-ink/60 mb-8">
                    The folder you're looking for doesn't exist or you don't have permission to access it.
                </p>
                
                <div className="flex gap-3 justify-center">
                    <Link
                        href="/folders"
                        className="inline-flex items-center gap-2 bg-brown-medium text-white px-4 py-2 rounded-lg hover:bg-brown-dark transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Folders
                    </Link>
                    
                    <Link
                        href="/home"
                        className="inline-flex items-center gap-2 bg-white text-ink border border-brown-light/20 px-2 rounded-lg hover:bg-stone-light transition-colors"
                    >
                        Go Home
                    </Link>
                </div>
            </div>
        </div>
    )
}
