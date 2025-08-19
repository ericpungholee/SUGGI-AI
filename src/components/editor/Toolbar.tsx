'use client'
import { 
    Bold, Italic, Underline, Strikethrough, 
    List, ListOrdered, Quote, Link2, 
    Heading1, Heading2, Heading3, Heading4,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Code, Highlighter, Undo2, Redo2,
    Sparkles, Palette, Type, Subscript, Superscript,
    ChevronDown
} from "lucide-react";
import { useState } from "react";
import { FormatState, ToolbarProps, ToolbarButton } from "@/types";

export default function Toolbar({ position, onFormat, formatState, onUndo, onRedo, canUndo, canRedo }: ToolbarProps) {
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showFontSizePicker, setShowFontSizePicker] = useState(false)
    const [showFontFamilyPicker, setShowFontFamilyPicker] = useState(false)

    const textFormatButtons = [
        { 
            icon: Bold, 
            command: 'bold', 
            tooltip: 'Bold (Ctrl+B)', 
            shortcut: 'Ctrl+B',
            active: formatState.bold 
        },
        { 
            icon: Italic, 
            command: 'italic', 
            tooltip: 'Italic (Ctrl+I)', 
            shortcut: 'Ctrl+I',
            active: formatState.italic 
        },
        { 
            icon: Underline, 
            command: 'underline', 
            tooltip: 'Underline (Ctrl+U)', 
            shortcut: 'Ctrl+U',
            active: formatState.underline 
        },
        { 
            icon: Strikethrough, 
            command: 'strikeThrough', 
            tooltip: 'Strikethrough', 
            shortcut: 'Ctrl+Shift+X',
            active: formatState.strikethrough 
        },
        { 
            icon: Subscript, 
            command: 'subscript', 
            tooltip: 'Subscript', 
            shortcut: 'Ctrl+=',
            active: formatState.subscript 
        },
        { 
            icon: Superscript, 
            command: 'superscript', 
            tooltip: 'Superscript', 
            shortcut: 'Ctrl+Shift+=',
            active: formatState.superscript 
        },
    ]

    const headingButtons = [
        { 
            icon: Heading1, 
            command: 'formatBlock', 
            value: 'h1', 
            tooltip: 'Heading 1', 
            shortcut: 'Ctrl+1',
            active: formatState.headingLevel === 'h1'
        },
        { 
            icon: Heading2, 
            command: 'formatBlock', 
            value: 'h2', 
            tooltip: 'Heading 2', 
            shortcut: 'Ctrl+2',
            active: formatState.headingLevel === 'h2'
        },
        { 
            icon: Heading3, 
            command: 'formatBlock', 
            value: 'h3', 
            tooltip: 'Heading 3', 
            shortcut: 'Ctrl+3',
            active: formatState.headingLevel === 'h3'
        },
        { 
            icon: Heading4, 
            command: 'formatBlock', 
            value: 'h4', 
            tooltip: 'Heading 4', 
            shortcut: 'Ctrl+4',
            active: formatState.headingLevel === 'h4'
        },
    ]

    const listButtons = [
        { 
            icon: List, 
            command: 'insertUnorderedList', 
            tooltip: 'Bullet List', 
            shortcut: 'Ctrl+Shift+L',
            active: formatState.listType === 'unordered'
        },
        { 
            icon: ListOrdered, 
            command: 'insertOrderedList', 
            tooltip: 'Numbered List', 
            shortcut: 'Ctrl+Shift+O',
            active: formatState.listType === 'ordered'
        },
    ]

    const alignmentButtons = [
        { 
            icon: AlignLeft, 
            command: 'justifyLeft', 
            tooltip: 'Align Left', 
            shortcut: 'Ctrl+L',
            active: formatState.alignment === 'left'
        },
        { 
            icon: AlignCenter, 
            command: 'justifyCenter', 
            tooltip: 'Align Center', 
            shortcut: 'Ctrl+E',
            active: formatState.alignment === 'center'
        },
        { 
            icon: AlignRight, 
            command: 'justifyRight', 
            tooltip: 'Align Right', 
            shortcut: 'Ctrl+R',
            active: formatState.alignment === 'right'
        },
        { 
            icon: AlignJustify, 
            command: 'justifyFull', 
            tooltip: 'Justify', 
            shortcut: 'Ctrl+J',
            active: formatState.alignment === 'justify'
        },
    ]

    const specialFormatButtons = [
        { 
            icon: Quote, 
            command: 'formatBlock', 
            value: 'blockquote', 
            tooltip: 'Quote Block', 
            shortcut: 'Ctrl+Shift+Q',
            active: false
        },
        { 
            icon: Code, 
            command: 'formatBlock', 
            value: 'pre', 
            tooltip: 'Code Block', 
            shortcut: 'Ctrl+Shift+K',
            active: false
        },
        { 
            icon: Highlighter, 
            command: 'backColor', 
            value: 'yellow', 
            tooltip: 'Highlight Text', 
            shortcut: 'Ctrl+Shift+H',
            active: false
        },
        { 
            icon: Link2, 
            command: 'createLink', 
            tooltip: 'Insert Link', 
            needsInput: true, 
            shortcut: 'Ctrl+K',
            active: false
        },
    ]

    const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px']
    const fontFamilies = [
        { name: 'Georgia', value: 'Georgia, serif' },
        { name: 'Arial', value: 'Arial, sans-serif' },
        { name: 'Times', value: 'Times New Roman, serif' },
        { name: 'Courier', value: 'Courier New, monospace' },
        { name: 'Verdana', value: 'Verdana, sans-serif' },
        { name: 'Helvetica', value: 'Helvetica, sans-serif' }
    ]

    const handleCommand = (command: string, value?: string, needsInput?: boolean) => {
        if (needsInput && command === 'createLink') {
            const url = prompt('Enter the URL:')
            if (url) onFormat(command, url)
        } else if (command === 'backColor') {
            onFormat(command, value)
        } else {
            onFormat(command, value)
        }
    }

    const renderButtonGroup = (buttons: ToolbarButton[], groupName: string) => (
        <div key={groupName} className="flex items-center gap-1">
            {buttons.map((button, index) => {
                const Icon = button.icon
                return (
                    <button
                        key={index}
                        onClick={() => handleCommand(button.command, button.value, button.needsInput)}
                        className={`p-2 rounded-lg transition-all duration-200 hover:scale-105 group relative ${
                            button.active 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'hover:bg-stone-light'
                        }`}
                        title={button.tooltip}
                    >
                        <Icon className={`w-4 h-4 transition-colors ${
                            button.active 
                                ? 'text-purple-700' 
                                : 'text-ink group-hover:text-purple-600'
                        }`} />
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-ink text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                            {button.tooltip}
                            {button.shortcut && (
                                <span className="block text-xs opacity-75 mt-1">{button.shortcut}</span>
                            )}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-ink"></div>
                        </div>
                    </button>
                )
            })}
        </div>
    )

    return (
        <div
            className='fixed z-50 bg-white border border-brown-light/20 rounded-xl shadow-2xl p-3 animate-fadeIn backdrop-blur-sm toolbar-container'
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                transform: 'translateX(-50%)',
            }}
        >
            <div className="flex items-center gap-2">
                {/* Undo/Redo */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        className="p-2 hover:bg-stone-light rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed group relative"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 className="w-4 h-4 text-ink group-hover:text-purple-600 transition-colors" />
                    </button>
                    <button
                        onClick={onRedo}
                        disabled={!canRedo}
                        className="p-2 hover:bg-stone-light rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed group relative"
                        title="Redo (Ctrl+Shift+Z)"
                    >
                        <Redo2 className="w-4 h-4 text-ink group-hover:text-purple-600 transition-colors" />
                    </button>
                </div>
                
                <div className="w-px h-6 bg-brown-light/20"></div>

                {/* Text Formatting */}
                {renderButtonGroup(textFormatButtons, 'text')}
                
                <div className="w-px h-6 bg-brown-light/20"></div>
                
                {/* Headings */}
                {renderButtonGroup(headingButtons, 'headings')}
                
                <div className="w-px h-6 bg-brown-light/20"></div>
                
                {/* Lists */}
                {renderButtonGroup(listButtons, 'lists')}
                
                <div className="w-px h-6 bg-brown-light/20"></div>
                
                {/* Alignment */}
                {renderButtonGroup(alignmentButtons, 'alignment')}
                
                <div className="w-px h-6 bg-brown-light/20"></div>
                
                {/* Special Formats */}
                {renderButtonGroup(specialFormatButtons, 'special')}
                
                <div className="w-px h-6 bg-brown-light/20"></div>

                {/* Text Color */}
                <div className="relative">
                    <button
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="p-2 hover:bg-stone-light rounded-lg transition-all duration-200 hover:scale-105 group relative"
                        title="Text Color"
                    >
                        <Palette className="w-4 h-4 text-ink group-hover:text-purple-600 transition-colors" />
                        <div 
                            className="w-3 h-3 rounded-full border border-gray-300 mt-1"
                            style={{ backgroundColor: formatState.color }}
                        />
                    </button>
                    
                    {showColorPicker && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
                            <div className="grid grid-cols-8 gap-1">
                                {['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
                                  '#800000', '#808000', '#008000', '#800080', '#008080', '#000080', '#FFA500', '#FFC0CB'].map((color) => (
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
                    )}
                </div>

                {/* Font Size */}
                <div className="relative">
                    <button
                        onClick={() => setShowFontSizePicker(!showFontSizePicker)}
                        className="p-2 hover:bg-stone-light rounded-lg transition-all duration-200 hover:scale-105 group relative flex items-center gap-1"
                        title="Font Size"
                    >
                        <Type className="w-4 h-4 text-ink group-hover:text-purple-600 transition-colors" />
                        <span className="text-xs text-ink">{formatState.fontSize}</span>
                        <ChevronDown className="w-3 h-3 text-ink" />
                    </button>
                    
                    {showFontSizePicker && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[80px]">
                            {fontSizes.map((size) => (
                                <button
                                    key={size}
                                    onClick={() => {
                                        onFormat('fontSize', size)
                                        setShowFontSizePicker(false)
                                    }}
                                    className="block w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm"
                                    style={{ fontSize: size }}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Font Family */}
                <div className="relative">
                    <button
                        onClick={() => setShowFontFamilyPicker(!showFontFamilyPicker)}
                        className="p-2 hover:bg-stone-light rounded-lg transition-all duration-200 hover:scale-105 group relative flex items-center gap-1"
                        title="Font Family"
                    >
                        <Type className="w-4 h-4 text-ink group-hover:text-purple-600 transition-colors" />
                        <span className="text-xs text-ink">{fontFamilies.find(f => f.value === formatState.fontFamily)?.name || 'Font'}</span>
                        <ChevronDown className="w-3 h-3 text-ink" />
                    </button>
                    
                    {showFontFamilyPicker && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[120px]">
                            {fontFamilies.map((font) => (
                                <button
                                    key={font.value}
                                    onClick={() => {
                                        onFormat('fontFamily', font.value)
                                        setShowFontFamilyPicker(false)
                                    }}
                                    className="block w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm"
                                    style={{ fontFamily: font.value }}
                                >
                                    {font.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="w-px h-6 bg-brown-light/20"></div>
                
                {/* AI Writing Assistant */}
                <button
                    onClick={() => {
                        // AI features
                        alert('AI features coming soon!')
                    }}
                    className="p-2 hover:bg-purple-50 rounded-lg transition-all duration-200 hover:scale-105 group relative"
                    title="AI Writing Assistant"
                >
                    <Sparkles className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-ink text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                        AI Writing Assistant
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-ink"></div>
                    </div>
                </button>
            </div>

            {/* Click outside to close dropdowns */}
            {(showColorPicker || showFontSizePicker || showFontFamilyPicker) && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => {
                        setShowColorPicker(false)
                        setShowFontSizePicker(false)
                        setShowFontFamilyPicker(false)
                    }}
                />
            )}
        </div>
    )
}