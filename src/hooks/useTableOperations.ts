/**
 * Table Operations Hook
 * Handles all table-related functionality for the editor
 */

import { useState, useCallback, useRef, useEffect } from 'react'

interface TableContextMenu {
    isOpen: boolean
    position: { x: number; y: number }
    tableElement?: HTMLTableElement
    cellElement?: HTMLTableCellElement
}

interface ColumnResizeData {
    startX: number
    startWidth: number
    cell: HTMLElement | null
}

interface RowResizeData {
    startY: number
    startHeight: number
    cell: HTMLElement | null
}

export const useTableOperations = (
    editorRef: React.RefObject<HTMLDivElement | null>,
    saveToUndoStack: (content: string) => void,
    updateFormatState: () => void
) => {
    const [showTableManager, setShowTableManager] = useState(false)
    const [isInsideTable, setIsInsideTable] = useState(false)
    const [tableContextMenu, setTableContextMenu] = useState<TableContextMenu>({
        isOpen: false,
        position: { x: 0, y: 0 }
    })
    
    // Simple resize state
    const [isResizingColumn, setIsResizingColumn] = useState(false)
    const [isResizingRow, setIsResizingRow] = useState(false)
    const [columnResizeData, setColumnResizeData] = useState<ColumnResizeData>({
        startX: 0,
        startWidth: 0,
        cell: null
    })
    const [rowResizeData, setRowResizeData] = useState<RowResizeData>({
        startY: 0,
        startHeight: 0,
        cell: null
    })

    // Check if cursor is inside a table
    const checkIfInsideTable = useCallback(() => {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const container = range.commonAncestorContainer
            const tableElement = container.nodeType === Node.ELEMENT_NODE 
                ? (container as Element).closest('table')
                : (container as Element).parentElement?.closest('table')
            
            return !!tableElement
        }
        return false
    }, [])

    // Table functions
    const insertTable = useCallback((rows: number, cols: number) => {
        if (!editorRef.current) return

        // Check if cursor is inside a table
        if (checkIfInsideTable()) {
            console.warn('Cannot insert table inside another table')
            return
        }

        // Save current state for undo
        const currentContent = editorRef.current.innerHTML
        saveToUndoStack(currentContent)
        
        // Create simple table HTML string
        let tableHTML = '<table class="editor-table" data-table="true"><tbody>'
        
        for (let i = 0; i < rows; i++) {
            tableHTML += '<tr>'
            for (let j = 0; j < cols; j++) {
                tableHTML += '<td contenteditable="true" data-table-cell="true"><br></td>'
            }
            tableHTML += '</tr>'
        }
        
        tableHTML += '</tbody></table><p><br></p>'
        
        // Get current cursor position
        const selection = window.getSelection()
        let range: Range
        
        if (selection && selection.rangeCount > 0) {
            range = selection.getRangeAt(0)
        } else {
            // Create range at the end of the editor
            range = document.createRange()
            range.selectNodeContents(editorRef.current)
            range.collapse(false)
        }
        
        // Insert the table HTML
        try {
            // Create a temporary container to parse the HTML
            const tempDiv = document.createElement('div')
            tempDiv.innerHTML = tableHTML
            
            // Insert each child node
            while (tempDiv.firstChild) {
                const node = tempDiv.firstChild
                tempDiv.removeChild(node)
                range.insertNode(node)
                range.setStartAfter(node)
            }
            
            // Update content
            const newContent = editorRef.current.innerHTML
            updateFormatState()
            
            // Focus on first cell
            setTimeout(() => {
                const firstCell = editorRef.current?.querySelector('td') as HTMLTableCellElement
                if (firstCell) {
                    const newRange = document.createRange()
                    newRange.selectNodeContents(firstCell)
                    newRange.collapse(true)
                    if (selection) {
                        selection.removeAllRanges()
                        selection.addRange(newRange)
                    }
                    firstCell.focus()
                }
            }, 50)
            
        } catch (error) {
            console.error('Error inserting table:', error)
            // Fallback: simple append
            editorRef.current.insertAdjacentHTML('beforeend', tableHTML)
            updateFormatState()
        }
    }, [editorRef, saveToUndoStack, updateFormatState, checkIfInsideTable])

    const handleTableContextMenu = useCallback((e: React.MouseEvent, tableElement: HTMLTableElement, cellElement?: HTMLTableCellElement) => {
        e.preventDefault()
        setTableContextMenu({
            isOpen: true,
            position: { x: e.clientX, y: e.clientY },
            tableElement,
            cellElement
        })
    }, [])

    const insertTableRow = useCallback((position: 'above' | 'below') => {
        const { cellElement } = tableContextMenu
        if (!cellElement || !editorRef.current) return

        const row = cellElement.parentElement as HTMLTableRowElement
        const table = cellElement.closest('table') as HTMLTableElement
        if (!row || !table) return

        saveToUndoStack(editorRef.current.innerHTML)

        const newRow = document.createElement('tr')
        const cellCount = row.cells.length
        
        for (let i = 0; i < cellCount; i++) {
            const td = document.createElement('td')
            td.setAttribute('contenteditable', 'true')
            td.setAttribute('data-table-cell', 'true')
            td.innerHTML = '&nbsp;'
            newRow.appendChild(td)
        }

        if (position === 'above') {
            row.parentNode?.insertBefore(newRow, row)
        } else {
            row.parentNode?.insertBefore(newRow, row.nextSibling)
        }

        updateFormatState()
        setTableContextMenu(prev => ({ ...prev, isOpen: false }))
    }, [tableContextMenu, editorRef, saveToUndoStack, updateFormatState])

    const insertTableColumn = useCallback((position: 'left' | 'right') => {
        const { cellElement } = tableContextMenu
        if (!cellElement || !editorRef.current) return

        const row = cellElement.parentElement as HTMLTableRowElement
        const table = cellElement.closest('table') as HTMLTableElement
        if (!row || !table) return

        saveToUndoStack(editorRef.current.innerHTML)

        const cellIndex = Array.from(row.cells).indexOf(cellElement)
        
        // Insert cell in all rows
        const rows = table.querySelectorAll('tr')
        rows.forEach(tr => {
            const td = document.createElement('td')
            td.setAttribute('contenteditable', 'true')
            td.setAttribute('data-table-cell', 'true')
            td.innerHTML = '&nbsp;'
            
            if (position === 'left') {
                tr.insertBefore(td, tr.children[cellIndex])
            } else {
                tr.insertBefore(td, tr.children[cellIndex + 1])
            }
        })

        updateFormatState()
        setTableContextMenu(prev => ({ ...prev, isOpen: false }))
    }, [tableContextMenu, editorRef, saveToUndoStack, updateFormatState])

    const deleteTableRow = useCallback(() => {
        const { cellElement } = tableContextMenu
        if (!cellElement || !editorRef.current) return

        const row = cellElement.parentElement as HTMLTableRowElement
        const table = cellElement.closest('table') as HTMLTableElement
        if (!row || !table) return

        // Don't delete if it's the only row
        if (table.rows.length <= 1) return

        saveToUndoStack(editorRef.current.innerHTML)
        row.remove()

        updateFormatState()
        setTableContextMenu(prev => ({ ...prev, isOpen: false }))
    }, [tableContextMenu, editorRef, saveToUndoStack, updateFormatState])

    const deleteTableColumn = useCallback(() => {
        const { cellElement } = tableContextMenu
        if (!cellElement || !editorRef.current) return

        const table = cellElement.closest('table') as HTMLTableElement
        if (!table) return

        // Don't delete if it's the only column
        if (table.rows[0]?.cells.length <= 1) return

        saveToUndoStack(editorRef.current.innerHTML)

        const cellIndex = Array.from((cellElement.parentElement as HTMLTableRowElement).cells).indexOf(cellElement)
        
        // Remove cell from all rows
        const rows = table.querySelectorAll('tr')
        rows.forEach(tr => {
            const cell = tr.children[cellIndex]
            if (cell) cell.remove()
        })

        updateFormatState()
        setTableContextMenu(prev => ({ ...prev, isOpen: false }))
    }, [tableContextMenu, editorRef, saveToUndoStack, updateFormatState])

    const deleteTable = useCallback(() => {
        const { tableElement } = tableContextMenu
        if (!tableElement || !editorRef.current) return

        saveToUndoStack(editorRef.current.innerHTML)
        tableElement.remove()

        updateFormatState()
        setTableContextMenu(prev => ({ ...prev, isOpen: false }))
    }, [tableContextMenu, editorRef, saveToUndoStack, updateFormatState])

    // Simple column resize functions
    const startColumnResize = useCallback((e: React.MouseEvent, cell: HTMLElement) => {
        e.preventDefault()
        const rect = cell.getBoundingClientRect()
        setColumnResizeData({
            startX: e.clientX,
            startWidth: rect.width,
            cell
        })
        setIsResizingColumn(true)
    }, [])

    const handleColumnMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingColumn || !columnResizeData.cell) return
        
        const deltaX = e.clientX - columnResizeData.startX
        const newWidth = Math.max(50, columnResizeData.startWidth + deltaX)
        
        // Apply width to all cells in the same column
        const table = columnResizeData.cell.closest('table')
        if (table) {
            const row = columnResizeData.cell.closest('tr')
            if (row) {
                const cellIndex = Array.from(row.children).indexOf(columnResizeData.cell)
                const allRows = table.querySelectorAll('tr')
                allRows.forEach(r => {
                    const cell = r.children[cellIndex] as HTMLElement
                    if (cell) cell.style.width = `${newWidth}px`
                })
            }
        }
    }, [isResizingColumn, columnResizeData])

    const handleColumnMouseUp = useCallback(() => {
        setIsResizingColumn(false)
        setColumnResizeData({ startX: 0, startWidth: 0, cell: null })
    }, [])

    useEffect(() => {
        if (isResizingColumn) {
            document.addEventListener('mousemove', handleColumnMouseMove)
            document.addEventListener('mouseup', handleColumnMouseUp)
            return () => {
                document.removeEventListener('mousemove', handleColumnMouseMove)
                document.removeEventListener('mouseup', handleColumnMouseUp)
            }
        }
        return undefined
    }, [isResizingColumn, handleColumnMouseMove, handleColumnMouseUp])

    // Simple row resize functions
    const startRowResize = useCallback((e: React.MouseEvent, cell: HTMLElement) => {
        e.preventDefault()
        const row = cell.closest('tr')
        if (row) {
            const rowRect = row.getBoundingClientRect()
            setRowResizeData({
                startY: e.clientY,
                startHeight: rowRect.height,
                cell
            })
            setIsResizingRow(true)
        }
    }, [])

    const handleRowMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingRow || !rowResizeData.cell) return
        
        const deltaY = e.clientY - rowResizeData.startY
        const newHeight = Math.max(30, rowResizeData.startHeight + deltaY)
        
        // Apply height to all cells in the same row
        const row = rowResizeData.cell.closest('tr')
        if (row) {
            const cells = row.querySelectorAll('td, th')
            cells.forEach(cell => {
                (cell as HTMLElement).style.height = `${newHeight}px`
            })
        }
    }, [isResizingRow, rowResizeData])

    const handleRowMouseUp = useCallback(() => {
        setIsResizingRow(false)
        setRowResizeData({ startY: 0, startHeight: 0, cell: null })
    }, [])

    useEffect(() => {
        if (isResizingRow) {
            document.addEventListener('mousemove', handleRowMouseMove)
            document.addEventListener('mouseup', handleRowMouseUp)
            return () => {
                document.removeEventListener('mousemove', handleRowMouseMove)
                document.removeEventListener('mouseup', handleRowMouseUp)
            }
        }
        return undefined
    }, [isResizingRow, handleRowMouseMove, handleRowMouseUp])

    return {
        showTableManager,
        setShowTableManager,
        isInsideTable,
        setIsInsideTable,
        tableContextMenu,
        setTableContextMenu,
        checkIfInsideTable,
        insertTable,
        handleTableContextMenu,
        insertTableRow,
        insertTableColumn,
        deleteTableRow,
        deleteTableColumn,
        deleteTable,
        startColumnResize,
        startRowResize,
        isResizingColumn,
        isResizingRow
    }
}