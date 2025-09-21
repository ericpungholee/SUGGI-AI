'use client'
import { useState, useRef, useEffect } from 'react'
import { Table, Plus, Minus, Move, Trash2 } from 'lucide-react'

interface TableManagerProps {
  isOpen: boolean
  onClose: () => void
  onInsertTable: (rows: number, cols: number) => void
  isInsideTable?: boolean
}

export default function TableManager({ isOpen, onClose, onInsertTable, isInsideTable = false }: TableManagerProps) {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const maxRows = 10
  const maxCols = 10

  const handleCellHover = (row: number, col: number) => {
    setHoveredCell({ row, col })
    setRows(row + 1)
    setCols(col + 1)
  }

  const handleInsert = () => {
    onInsertTable(rows, cols)
    onClose()
  }

  const quickSizes = [
    { rows: 1, cols: 2, label: '1×2' },
    { rows: 2, cols: 2, label: '2×2' },
    { rows: 2, cols: 3, label: '2×3' },
    { rows: 3, cols: 3, label: '3×3' },
    { rows: 3, cols: 4, label: '3×4' },
    { rows: 4, cols: 4, label: '4×4' },
    { rows: 4, cols: 5, label: '4×5' },
    { rows: 5, cols: 5, label: '5×5' },
    { rows: 6, cols: 6, label: '6×6' }
  ]

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        ref={containerRef}
        className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Table className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-black">Insert Table</h3>
            <p className="text-sm text-gray-600">
              {isInsideTable ? 'Cannot insert table inside another table' : 'Choose a table size'}
            </p>
          </div>
        </div>

        {isInsideTable && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-xs font-bold">!</span>
              </div>
              <div>
                <p className="text-sm font-medium text-red-800">Table Insertion Not Allowed</p>
                <p className="text-xs text-red-600">Please move your cursor outside of the table to insert a new table.</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Sizes</h4>
          <div className="grid grid-cols-3 gap-2">
            {quickSizes.map((size, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!isInsideTable) {
                    onInsertTable(size.rows, size.cols)
                    onClose()
                  }
                }}
                disabled={isInsideTable}
                className={`p-2 border rounded-lg transition-colors text-center ${
                  isInsideTable 
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                    : 'border-gray-300 hover:bg-gray-100 hover:border-black'
                }`}
              >
                <div className={`text-xs font-medium ${isInsideTable ? 'text-gray-400' : 'text-black'}`}>
                  {size.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Custom Size</h4>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Rows:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  disabled={isInsideTable}
                  className={`w-16 px-2 py-1 border rounded text-sm text-center focus:outline-none ${
                    isInsideTable 
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' 
                      : 'border-gray-300 focus:border-black'
                  }`}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Columns:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  disabled={isInsideTable}
                  className={`w-16 px-2 py-1 border rounded text-sm text-center focus:outline-none ${
                    isInsideTable 
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' 
                      : 'border-gray-300 focus:border-black'
                  }`}
                />
              </div>
              <button
                onClick={() => {
                  if (!isInsideTable) {
                    handleInsert()
                  }
                }}
                disabled={isInsideTable}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  isInsideTable 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                Insert
              </button>
            </div>
            
            {/* Visual Preview */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Preview:</span>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, 8px)`, gridTemplateRows: `repeat(${rows}, 8px)` }}>
                {Array.from({ length: rows * cols }, (_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-gray-300 border border-gray-400"
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">{rows}×{cols}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Click a size to insert
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// Table context menu component
interface TableContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  onClose: () => void
  onInsertRowAbove: () => void
  onInsertRowBelow: () => void
  onInsertColumnLeft: () => void
  onInsertColumnRight: () => void
  onDeleteRow: () => void
  onDeleteColumn: () => void
  onDeleteTable: () => void
}

export function TableContextMenu({
  isOpen,
  position,
  onClose,
  onInsertRowAbove,
  onInsertRowBelow,
  onInsertColumnLeft,
  onInsertColumnRight,
  onDeleteRow,
  onDeleteColumn,
  onDeleteTable
}: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-2 min-w-[180px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
        Table Options
      </div>
      
      <button
        onClick={onInsertRowAbove}
        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Insert row above
      </button>
      
      <button
        onClick={onInsertRowBelow}
        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Insert row below
      </button>
      
      <div className="border-t border-gray-100 my-1"></div>
      
      <button
        onClick={onInsertColumnLeft}
        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Insert column left
      </button>
      
      <button
        onClick={onInsertColumnRight}
        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Insert column right
      </button>
      
      <div className="border-t border-gray-100 my-1"></div>
      
      <button
        onClick={onDeleteRow}
        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
      >
        <Minus className="w-4 h-4" />
        Delete row
      </button>
      
      <button
        onClick={onDeleteColumn}
        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
      >
        <Minus className="w-4 h-4" />
        Delete column
      </button>
      
      <div className="border-t border-gray-100 my-1"></div>
      
      <button
        onClick={onDeleteTable}
        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
      >
        <Trash2 className="w-4 h-4" />
        Delete table
      </button>
    </div>
  )
}
