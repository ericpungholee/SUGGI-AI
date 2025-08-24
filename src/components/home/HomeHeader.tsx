'use client'
import { Grid3x3, List, SortAsc } from 'lucide-react'
import { useState } from 'react'

interface HomeHeaderProps {
  title?: string
}

export default function HomeHeader({ title = "My Documents" }: HomeHeaderProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  return (
    <header className="h-16 bg-white border-b border-brown-light/20 px-8 flex items-center justify-between">
      <h1 className="text-2xl font-medium text-ink">{title}</h1>
      
      <div className="flex items-center gap-4">
        {/* Sort */}
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-ink/60 hover:text-ink transition-colors">
          <SortAsc className="w-4 h-4" />
          <span>Last Modified</span>
        </button>
        
        {/* View Toggle */}
        <div className="flex items-center bg-stone-light rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
          >
            <Grid3x3 className="w-4 h-4 text-ink" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
          >
            <List className="w-4 h-4 text-ink" />
          </button>
        </div>
      </div>
    </header>
  )
}