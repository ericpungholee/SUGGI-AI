/**
 * Table Manager Component
 * Handles table insertion and management UI
 */

import React from 'react'

interface TableManagerProps {
    isOpen: boolean
    onClose: () => void
    onInsertTable: (rows: number, cols: number) => void
}

export default function TableManager({ isOpen, onClose, onInsertTable }: TableManagerProps) {
    const [rows, setRows] = React.useState(3)
    const [cols, setCols] = React.useState(3)

    if (!isOpen) return null

    const handleInsert = () => {
        onInsertTable(rows, cols)
        onClose()
    }

    const generatePreview = () => {
        const preview = []
        for (let i = 0; i < Math.min(rows, 5); i++) {
            const row = []
            for (let j = 0; j < Math.min(cols, 5); j++) {
                row.push(<div key={j} className="w-6 h-6 border border-gray-300 bg-white"></div>)
            }
            preview.push(<div key={i} className="flex gap-0.5">{row}</div>)
        }
        return preview
    }

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Insert Table</h3>
                
                <div className="space-y-4">
                    {/* Dimensions */}
                    <div className="flex items-center gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rows</label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={rows}
                                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                                className="w-20 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Columns</label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={cols}
                                onChange={(e) => setCols(parseInt(e.target.value) || 1)}
                                className="w-20 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                        <div className="p-3 bg-gray-50 rounded-md border">
                            <div className="space-y-0.5">
                                {generatePreview()}
                            </div>
                            {rows > 5 || cols > 5 ? (
                                <p className="text-xs text-gray-500 mt-2">
                                    Showing first 5x5 cells
                                </p>
                            ) : null}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end pt-4">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleInsert}
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                        >
                            Insert Table
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}