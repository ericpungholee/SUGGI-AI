/**
 * Editor Toolbar Component
 * Contains all the formatting controls for the editor
 */

import React, { useState, useRef, useEffect } from 'react'
import { 
    Bold, Italic, Underline, Strikethrough, 
    List, ListOrdered, Quote, Link2, 
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Code, Undo2, Redo2,
    Palette, ArrowLeft, Trash2, Feather, Check, Table
} from "lucide-react"
import { FormatState } from '@/types'

interface EditorToolbarProps {
    // Navigation
    onNavigate: (url: string) => void
    
    // Document management
    documentId: string
    documentTitle: string
    onTitleChange: (title: string) => void
    onSave: () => void
    onDelete: () => void
    isSaving: boolean
    justSaved: boolean
    hasUnsavedChanges: boolean
    saveError: string | null
    isLoading: boolean
    isSavingTitle: boolean
    
    // Undo/Redo
    onUndo: () => void
    onRedo: () => void
    canUndo: boolean
    canRedo: boolean
    
    // Formatting
    formatState: FormatState
    onFormat: (command: string, value?: string) => void
    
    // Table management
    onShowTableManager: () => void
    checkIfInsideTable: () => boolean
    
    // AI Chat
    isAIChatOpen: boolean
    onToggleAIChat: () => void
}

export default function EditorToolbar({
    onNavigate,
    documentId,
    documentTitle,
    onTitleChange,
    onSave,
    onDelete,
    isSaving,
    justSaved,
    hasUnsavedChanges,
    saveError,
    isLoading,
    isSavingTitle,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    formatState,
    onFormat,
    onShowTableManager,
    checkIfInsideTable,
    isAIChatOpen,
    onToggleAIChat
}: EditorToolbarProps) {
    const [showColorPicker, setShowColorPicker] = useState(false)
    const colorPickerRef = useRef<HTMLDivElement>(null)

    const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px']
    const fontFamilies = [
        { name: 'Arial', value: 'Arial, sans-serif' },
        { name: 'Georgia', value: 'Georgia, serif' },
        { name: 'Times', value: 'Times New Roman, serif' },
        { name: 'Courier', value: 'Courier New, monospace' },
        { name: 'Verdana', value: 'Verdana, sans-serif' },
        { name: 'Helvetica', value: 'Helvetica, sans-serif' }
    ]

    // Close color picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                setShowColorPicker(false)
            }
        }

        if (showColorPicker) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
        
        return undefined
    }, [showColorPicker])

    return (
        <div className="h-14 editor-toolbar flex items-center px-4 gap-2 overflow-x-auto min-w-0">
            {/* Back Button */}
            <button 
                onClick={() => onNavigate("/home")}
                className="p-1 hover:bg-gray-100 rounded transition-colors mr-0.5"
                title="Back to Home"
                suppressHydrationWarning
            >
                <ArrowLeft className="w-3 h-3 text-gray-600" />
            </button>
            
            <div className="w-px h-4 bg-gray-300"></div>
            
            {/* Undo/Redo */}
            <div className="flex items-center gap-0.5 mr-0.5">
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Undo (Ctrl+Z)"
                    suppressHydrationWarning
                >
                    <Undo2 className="w-3 h-3 text-gray-600" />
                </button>
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Redo (Ctrl+Shift+Z)"
                    suppressHydrationWarning
                >
                    <Redo2 className="w-3 h-3 text-gray-600" />
                </button>
            </div>
            
            <div className="w-px h-6 bg-gray-300"></div>

            {/* Document Title */}
            <div className="flex-1 min-w-0 ml-1 mr-1" style={{ minWidth: '120px', maxWidth: '250px' }}>
                <div className="relative z-10">
                    {isLoading ? (
                        <div className="w-full px-2 py-1.5 text-base font-semibold text-gray-400 bg-gray-50 rounded animate-pulse">
                            Loading...
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={documentTitle || 'Untitled Document'}
                            onChange={(e) => onTitleChange(e.target.value)}
                            className={`w-full px-2 py-1.5 text-base font-semibold text-black bg-white border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors min-w-0 ${
                                isSavingTitle ? 'ring-2 ring-blue-300 bg-blue-50 border-blue-300' : ''
                            }`}
                            placeholder="Untitled Document"
                            suppressHydrationWarning
                            maxLength={100}
                        />
                    )}
                    {documentTitle && documentTitle.length > 80 && !isLoading && (
                        <div className="text-xs text-gray-400 mt-1">
                            {documentTitle.length}/100 characters
                        </div>
                    )}
                    {documentId !== 'new' && !isLoading && isSavingTitle && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                            <span className="text-blue-600">Saving...</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Save Button and Status */}
            <div className="flex items-center gap-0.5 mr-1">
                <button
                    onClick={() => {
                        console.log('🔘 Save button clicked:', {
                            documentId,
                            isSaving,
                            hasUnsavedChanges,
                            justSaved,
                            saveError
                        })
                        onSave()
                    }}
                    disabled={isSaving || documentId === 'new'}
                    className={`p-1 rounded-lg transition-all ${
                        justSaved
                            ? 'bg-white text-blue-600 border-2 border-blue-500'
                            : isSaving
                                ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                                : hasUnsavedChanges
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={documentId === 'new' ? 'Save document first' : hasUnsavedChanges ? 'Save document (Ctrl+S)' : 'All changes saved'}
                    suppressHydrationWarning
                >
                    <Check className="w-3 h-3" />
                </button>
                
                {/* Save Status Indicator */}
                {saveError && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                        <span className="text-red-600">⚠️</span>
                        <span className="text-sm text-red-700">{saveError}</span>
                    </div>
                )}
            </div>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Delete Button */}
            {documentId !== 'new' && (
                <button
                    onClick={onDelete}
                    className="p-1 rounded-lg transition-all bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 hover:border-red-300"
                    title="Delete document"
                    suppressHydrationWarning
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            )}

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Font Family */}
            <select
                value={fontFamilies.find(f => f.value === formatState.fontFamily)?.value || 'Arial, sans-serif'}
                onChange={(e) => onFormat('fontFamily', e.target.value)}
                className="px-1 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                suppressHydrationWarning
            >
                {fontFamilies.map((font) => (
                    <option key={font.value} value={font.value}>{font.name}</option>
                ))}
            </select>

            {/* Font Size */}
            <select
                value={formatState.fontSize}
                onChange={(e) => onFormat('fontSize', e.target.value)}
                className="px-1 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-12"
                suppressHydrationWarning
            >
                {fontSizes.map((size) => (
                    <option key={size} value={size}>{size}</option>
                ))}
            </select>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Text Formatting */}
            <button
                onClick={() => onFormat('bold')}
                className={`p-1.5 rounded transition-colors ${formatState.bold ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Bold (Ctrl+B)"
                suppressHydrationWarning
            >
                <Bold className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={() => onFormat('italic')}
                className={`p-1.5 rounded transition-colors ${formatState.italic ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Italic (Ctrl+I)"
                suppressHydrationWarning
            >
                <Italic className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={() => onFormat('underline')}
                className={`p-1.5 rounded transition-colors ${formatState.underline ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Underline (Ctrl+U)"
                suppressHydrationWarning
            >
                <Underline className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={() => onFormat('strikeThrough')}
                className={`p-1.5 rounded transition-colors ${formatState.strikethrough ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Strikethrough"
                suppressHydrationWarning
            >
                <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Text Color */}
            <div className="relative" ref={colorPickerRef}>
                <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors group relative flex flex-col items-center gap-1"
                    title="Text Color"
                    suppressHydrationWarning
                >
                    <Palette className="w-3.5 h-3.5 transition-colors" style={{ color: formatState.color }} />
                </button>
                
                {showColorPicker && (
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 p-3 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[200px]">
                        <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-700 mb-2">Predefined Colors</label>
                            <div className="grid grid-cols-8 gap-1">
                                {[
                                    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
                                    '#800000', '#808000', '#008000', '#800080', '#008080', '#000080', '#FFA500', '#FFC0CB',
                                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
                                    '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#A8E6CF', '#D2B4DE', '#AED6F1'
                                ].map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => {
                                            onFormat('foreColor', color)
                                            setShowColorPicker(false)
                                        }}
                                        className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>
                        
                        {/* Simple HTML Color Picker */}
                        <div className="border-t border-gray-200 pt-3">
                            <label className="block text-xs font-medium text-gray-700 mb-2">Custom Color</label>
                            <div className="space-y-3">
                                {/* HTML Color Input without eyedropper */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={formatState.color}
                                        onChange={(e) => onFormat('foreColor', e.target.value)}
                                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                                        style={{ 
                                            WebkitAppearance: 'none',
                                            appearance: 'none',
                                            background: 'none',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '4px'
                                        }}
                                    />
                                    <input
                                        type="text"
                                        value={formatState.color}
                                        onChange={(e) => {
                                            const value = e.target.value
                                            if (value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                                onFormat('foreColor', value)
                                            }
                                        }}
                                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Headings */}
            <button
                onClick={() => onFormat('formatBlock', 'h1')}
                className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'h1' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Heading 1"
                suppressHydrationWarning
            >
                H1
            </button>
            <button
                onClick={() => onFormat('formatBlock', 'h2')}
                className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'h2' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Heading 2"
                suppressHydrationWarning
            >
                H2
            </button>
            <button
                onClick={() => onFormat('formatBlock', 'h3')}
                className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'h3' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Heading 3"
                suppressHydrationWarning
            >
                H3
            </button>
            <button
                onClick={() => onFormat('formatBlock', 'p')}
                className={`px-3 py-1 rounded text-sm transition-colors ${formatState.headingLevel === 'p' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Paragraph (Ctrl+0)"
                suppressHydrationWarning
            >
                P
            </button>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Lists */}
            <button
                onClick={() => onFormat('insertUnorderedList')}
                className={`p-2 rounded transition-colors ${formatState.listType === 'unordered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Bullet List"
                suppressHydrationWarning
            >
                <List className="w-4 h-4" />
            </button>
            <button
                onClick={() => onFormat('insertOrderedList')}
                className={`p-2 rounded transition-colors ${formatState.listType === 'ordered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Numbered List"
                suppressHydrationWarning
            >
                <ListOrdered className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Alignment */}
            <button
                onClick={() => onFormat('justifyLeft')}
                className={`p-2 rounded transition-colors ${formatState.alignment === 'left' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Align Left"
                suppressHydrationWarning
            >
                <AlignLeft className="w-4 h-4" />
            </button>
            <button
                onClick={() => onFormat('justifyCenter')}
                className={`p-2 rounded transition-colors ${formatState.alignment === 'center' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Align Center"
                suppressHydrationWarning
            >
                <AlignCenter className="w-4 h-4" />
            </button>
            <button
                onClick={() => onFormat('justifyRight')}
                className={`p-2 rounded transition-colors ${formatState.alignment === 'right' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Align Right"
                suppressHydrationWarning
            >
                <AlignRight className="w-4 h-4" />
            </button>
            <button
                onClick={() => onFormat('justifyFull')}
                className={`p-2 rounded transition-colors ${formatState.alignment === 'justify' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                title="Justify"
                suppressHydrationWarning
            >
                <AlignJustify className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Special Formats */}
            <button
                onClick={() => onFormat('formatBlock', 'blockquote')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Quote Block"
                suppressHydrationWarning
            >
                <Quote className="w-4 h-4 text-gray-600" />
            </button>
            <button
                onClick={() => onFormat('formatBlock', 'pre')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Code Block"
                suppressHydrationWarning
            >
                <Code className="w-4 h-4 text-gray-600" />
            </button>
            <button
                onClick={() => onFormat('createLink')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Insert Link (Ctrl+K)"
                suppressHydrationWarning
            >
                <Link2 className="w-4 h-4 text-gray-600" />
            </button>
            <button
                onClick={() => {
                    const insideTable = checkIfInsideTable()
                    onShowTableManager()
                }}
                className="p-2 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                title="Insert Table"
                suppressHydrationWarning
            >
                <Table className="w-4 h-4 text-gray-600" />
            </button>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* AI Chat Toggle */}
            <button
                onClick={onToggleAIChat}
                className={`p-2 rounded transition-colors flex-shrink-0 ${
                    isAIChatOpen 
                        ? 'bg-black text-white' 
                        : 'hover:bg-gray-100 text-black'
                }`}
                title="Toggle AI Assistant (Ctrl+Shift+L)"
                suppressHydrationWarning
            >
                <Feather className="w-4 h-4" />
            </button>
        </div>
    )
}