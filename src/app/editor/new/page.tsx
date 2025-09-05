'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

export default function NewDocumentPage() {
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const hasInitiated = useRef(false)
    const { data: session, status } = useSession()
    const router = useRouter()

    useEffect(() => {
        if (status === 'loading') return
        
        if (!session?.user) {
            router.push('/auth/login')
            return
        }

        // Only create document once using ref to prevent multiple calls
        if (!hasInitiated.current && !isCreating) {
            hasInitiated.current = true
            createNewDocument()
        }
    }, [session, status, router, isCreating])

    const createNewDocument = async () => {
        if (isCreating) return
        
        setIsCreating(true)
        setError(null)

        try {
            const response = await fetch('/api/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Untitled Document',
                    content: '<p>Start writing your document here...</p>'
                })
            })

            if (response.ok) {
                const newDocument = await response.json()
                // Redirect to the editor with the new document ID
                router.push(`/editor/${newDocument.id}`)
            } else {
                const errorData = await response.json()
                console.error('Failed to create document:', response.status, errorData)
                setError(errorData.error || `Failed to create document (${response.status})`)
            }
        } catch (err) {
            console.error('Error creating document:', err)
            setError('Failed to create document. Please check your connection and try again.')
        } finally {
            setIsCreating(false)
        }
    }

    if (status === 'loading' || isCreating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-light">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brown-medium" />
                    <p className="text-ink/70">Creating your new document...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-light">
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-ink mb-2">Error Creating Document</h3>
                    <p className="text-ink/60 mb-6">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => {
                                hasInitiated.current = false
                                createNewDocument()
                            }}
                            className="bg-brown-medium text-white px-4 py-2 rounded-lg hover:bg-brown-dark transition-colors"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => router.push('/home')}
                            className="bg-white text-ink border border-brown-light/20 px-4 py-2 rounded-lg hover:bg-stone-light transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return null
}
