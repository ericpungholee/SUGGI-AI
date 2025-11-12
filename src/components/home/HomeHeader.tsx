'use client'

import { Grid3x3, LayoutGrid, Square } from 'lucide-react'

interface HomeHeaderProps {
  title: string
  gridDensity?: 'compact' | 'comfortable' | 'spacious'
  onGridDensityChange?: (density: 'compact' | 'comfortable' | 'spacious') => void
}

export default function HomeHeader({ 
  title, 
  gridDensity, 
  onGridDensityChange 
}: HomeHeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-black flex items-center justify-between px-8">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      
      {gridDensity && onGridDensityChange && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onGridDensityChange('compact')}
            className={`
              p-2 transition-colors
              ${gridDensity === 'compact' 
                ? 'text-black' 
                : 'text-black/40 hover:text-black'
              }
            `}
            title="Compact"
          >
            <Grid3x3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => onGridDensityChange('comfortable')}
            className={`
              p-2 transition-colors
              ${gridDensity === 'comfortable' 
                ? 'text-black' 
                : 'text-black/40 hover:text-black'
              }
            `}
            title="Comfortable"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => onGridDensityChange('spacious')}
            className={`
              p-2 transition-colors
              ${gridDensity === 'spacious' 
                ? 'text-black' 
                : 'text-black/40 hover:text-black'
              }
            `}
            title="Spacious"
          >
            <Square className="w-5 h-5" />
          </button>
        </div>
      )}
    </header>
  )
}

