'use client'
import { useState, useEffect } from 'react'
import HomeHeader from '../home/HomeHeader'
import FoldersPageContent from './FoldersPageContent'

export default function FoldersPageWrapper() {
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
                title="My Folders" 
                gridDensity={gridDensity}
                onGridDensityChange={handleGridDensityChange}
            />

            {/* Content */}
            <FoldersPageContent gridDensity={gridDensity} />
        </>
    )
}
