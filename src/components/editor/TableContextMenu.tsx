/**
 * Table Context Menu Component
 * Provides right-click context menu for table operations
 */

import React from 'react'

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

export default function TableContextMenu({
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
  if (!isOpen) return null

  return (
    <div
      className="fixed z-50 bg-white border border-gray-300 rounded-md shadow-lg py-1 min-w-[160px]"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
        onClick={onInsertRowAbove}
      >
        Insert Row Above
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
        onClick={onInsertRowBelow}
      >
        Insert Row Below
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
        onClick={onInsertColumnLeft}
      >
        Insert Column Left
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
        onClick={onInsertColumnRight}
      >
        Insert Column Right
      </button>
      <hr className="my-1" />
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-red-600"
        onClick={onDeleteRow}
      >
        Delete Row
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-red-600"
        onClick={onDeleteColumn}
      >
        Delete Column
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-red-600"
        onClick={onDeleteTable}
      >
        Delete Table
      </button>
    </div>
  )
}
