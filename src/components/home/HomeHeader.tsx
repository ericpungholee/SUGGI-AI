'use client'
import { Grid3x3, List, SortAsc, LayoutGrid, MoreHorizontal } from 'lucide-react'
import { useState, useEffect } from 'react'

interface HomeHeaderProps {
  title?: string
  gridDensity?: 'compact' | 'comfortable' | 'spacious'
  onGridDensityChange?: (density: 'compact' | 'comfortable' | 'spacious') => void
}

export default function HomeHeader({ title = "My Documents", gridDensity = 'comfortable', onGridDensityChange }: HomeHeaderProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showGridOptions, setShowGridOptions] = useState(false)

  // Close grid options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showGridOptions && !(event.target as Element).closest('.grid-options-container')) {
        setShowGridOptions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showGridOptions])

  const handleGridDensityChange = (density: 'compact' | 'comfortable' | 'spacious') => {
    onGridDensityChange?.(density)
    setShowGridOptions(false)
  }

  const getGridDensityLabel = (density: string) => {
    switch (density) {
      case 'compact': return 'Compact'
      case 'comfortable': return 'Comfortable'
      case 'spacious': return 'Spacious'
      default: return 'Comfortable'
    }
  }

  const getGridDensityIcon = (density: string) => {
    switch (density) {
      case 'compact': return '●●●'
      case 'comfortable': return '●●'
      case 'spacious': return '●'
      default: return '●●'
    }
  }

  return (
    <header className="h-16 bg-white border-b border-brown-light/20 px-8 flex items-center justify-between">
      <h1 className="text-2xl font-medium text-ink">{title}</h1>
      
      <div className="flex items-center gap-4">
        {/* Sort */}
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-ink/60 hover:text-ink transition-colors">
          <SortAsc className="w-4 h-4" />
          <span>Last Modified</span>
        </button>
        
        {/* Grid Density Selector - only show when in grid mode */}
        {viewMode === 'grid' && (
          <div className="relative grid-options-container">
            <button
              onClick={() => setShowGridOptions(!showGridOptions)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-ink/60 hover:text-ink transition-colors bg-stone-light rounded-lg"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>{getGridDensityLabel(gridDensity)}</span>
              <MoreHorizontal className="w-3 h-3" />
            </button>
            
            {showGridOptions && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-40">
                <div className="py-1">
                  {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                    <button
                      key={density}
                      onClick={() => handleGridDensityChange(density)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        gridDensity === density ? 'text-ink bg-gray-50' : 'text-ink/60'
                      }`}
                    >
                      <span className="text-lg">{getGridDensityIcon(density)}</span>
                      <span>{getGridDensityLabel(density)}</span>
                      {gridDensity === density && (
                        <div className="ml-auto w-2 h-2 bg-brown-medium rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
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