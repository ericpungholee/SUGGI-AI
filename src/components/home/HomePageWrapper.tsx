'use client'
import { useState, useEffect } from 'react'
import HomeHeader from './HomeHeader'
import HomeContent from './HomeContent'

interface HomePageWrapperProps {
    hasContent: boolean
    folders: number
    documents: number
}

export default function HomePageWrapper({ hasContent, folders, documents }: HomePageWrapperProps) {
    const [gridDensity, setGridDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable')

    // Load saved preferences from localStorage
    useEffect(() => {
        const savedDensity = localStorage.getItem('gridDensity') as 'compact' | 'comfortable' | 'spacious'
        if (savedDensity) {
            setGridDensity(savedDensity)
        }
    }, [])

    const handleGridDensityChange = (density: 'compact' | 'comfortable' | 'spacious') => {
        setGridDensity(density)
    }

    return (
        <>
            {/* Header */}
            <HomeHeader 
                title="Home" 
                gridDensity={gridDensity}
                onGridDensityChange={handleGridDensityChange}
            />

            {/* Content */}
            <main className="flex-1 overflow-y-auto px-8 py-6 bg-white">
                <HomeContent 
                    hasContent={hasContent}
                    folders={folders}
                    documents={documents}
                    gridDensity={gridDensity}
                />
            </main>
        </>
    )
}
