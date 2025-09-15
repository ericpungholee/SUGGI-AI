'use client'
import { ArrowBigLeft, Save, Share2, MoreVertical, Check, Cloud, FileText } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function EditorHeader({ documentId }: { documentId: string }) {
    const [title, setTitle] = useState('Untitled Document');
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Set mounted state to prevent hydration mismatch
    useEffect(() => {
        setMounted(true)
        setLastSaved(new Date())
    }, [])

    // Auto save simulation
    useEffect(() => {
        if (!mounted) return
        
        const timer = setTimeout(() => {
            setSaveStatus('saving')
            setTimeout(() => {
                setSaveStatus('saved')
                setLastSaved(new Date())
            }, 1000)
        }, 2000)

        return () => clearTimeout(timer)
    }, [title, mounted])

    const handleTitleSave = () => {
        setIsEditingTitle(false)
        // Here you would save the title to your backend
    }

    const handleManualSave = () => {
        setSaveStatus('saving')
        setTimeout(() => {
            setSaveStatus('saved')
            setLastSaved(new Date())
        }, 1000)
    }

    return (
        <header className='h-16 border-b border-brown-light/20 bg-white/90 backdrop-blur-sm flex items-center justify-between px-6 shadow-sm'>
            <div className="flex items-center gap-4">
                {/* Back button */}
                <Link href="/home"
                    className="p-2 hover:bg-stone-light rounded-lg transition-colors group">
                    <ArrowBigLeft className='w-5 h-5 text-ink group-hover:-translate-x-1 transition-transform' />
                </Link>

                {/* Document Icon */}
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-600" />
                </div>

                {/* Document Title */}
                <div className="flex items-center gap-2">
                    {isEditingTitle ? (
                        <input
                            type='text'
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={handleTitleSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                            className='text-lg font-semibold text-ink bg-transparent border-b-2 border-purple-500 outline-none px-1'
                            placeholder='Untitled Document'
                            autoFocus
                        />
                    ) : (
                        <button
                            onClick={() => setIsEditingTitle(true)}
                            className='text-lg font-semibold text-ink hover:text-purple-600 transition-colors px-1'
                        >
                            {title}
                        </button>
                    )}
                </div>
            </div>

            <div className='flex items-center gap-4'>
                {/* Save Status */}
                <div className='flex items-center gap-2 text-sm text-ink/60'>
                    {saveStatus === 'saved' && (
                        <>
                            <Check className='w-4 h-4 text-blue-600' />
                            <span>Saved</span>
                        </>
                    )}
                    {saveStatus === 'saving' && (
                        <>
                            <Cloud className='w-4 h-4 animate-pulse text-blue-600' />
                            <span>Saving...</span>
                        </>
                    )}
                    {saveStatus === 'error' && (
                        <>
                            <span className='text-red-600'>Error</span>
                        </>
                    )}
                </div>

                {/* Last Saved - Only show when mounted to prevent hydration mismatch */}
                {mounted && lastSaved && (
                    <span className='text-xs text-ink/40'>
                        {lastSaved.toLocaleTimeString()}
                    </span>
                )}

                {/* Actions */}
                <button 
                    onClick={handleManualSave}
                    className='p-2 hover:bg-stone-light rounded-lg transition-colors'
                    title="Save manually"
                >
                    <Save className='w-5 h-5 text-ink/60' />
                </button>
                
                <button className='p-2 hover:bg-stone-light rounded-lg transition-colors' title="Share">
                    <Share2 className='w-5 h-5 text-ink/60' />
                </button>
                
                <button className='p-2 hover:bg-stone-light rounded-lg transition-colors' title="More options">
                    <MoreVertical className='w-5 h-5 text-ink/60' />
                </button>
            </div>
        </header>
    )
}
