'use client'
import { useState } from 'react'
import { 
    Bold, Italic, Underline, 
    List, ListOrdered, 
    AlignLeft, AlignCenter, AlignRight,
    MoreHorizontal, ChevronDown
} from 'lucide-react'
import { FormatState, ToolbarProps } from '@/types'

interface MobileToolbarProps extends ToolbarProps {
    isMobile: boolean
}

export default function MobileToolbar({ 
    position, 
    onFormat, 
    formatState, 
    onUndo, 
    onRedo, 
    canUndo, 
    canRedo, 
    onAIClick, 
    onTableClick,
    isMobile 
}: MobileToolbarProps) {
    const [showMoreOptions, setShowMoreOptions] = useState(false)

    if (!isMobile) return null

    const basicFormatButtons = [
        { icon: Bold, command: 'bold', tooltip: 'Bold', active: formatState.bold },
        { icon: Italic, command: 'italic', tooltip: 'Italic', active: formatState.italic },
        { icon: Underline, command: 'underline', tooltip: 'Underline', active: formatState.underline },
        { icon: List, command: 'insertUnorderedList', tooltip: 'Bullet List', active: formatState.listType === 'unordered' },
        { icon: ListOrdered, command: 'insertOrderedList', tooltip: 'Numbered List', active: formatState.listType === 'ordered' },
    ]

    const alignmentButtons = [
        { icon: AlignLeft, command: 'justifyLeft', tooltip: 'Align Left', active: formatState.alignment === 'left' },
        { icon: AlignCenter, command: 'justifyCenter', tooltip: 'Align Center', active: formatState.alignment === 'center' },
        { icon: AlignRight, command: 'justifyRight', tooltip: 'Align Right', active: formatState.alignment === 'right' },
    ]

    const handleCommand = (command: string, value?: string) => {
        onFormat(command, value)
        if (command !== 'bold' && command !== 'italic' && command !== 'underline') {
            setShowMoreOptions(false)
        }
    }

    return (
        <div
            className='fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-2 animate-fadeIn backdrop-blur-sm'
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                transform: 'translateX(-50%)',
                minWidth: '280px',
                maxWidth: '90vw'
            }}
        >
            {/* Main toolbar row */}
            <div className="flex items-center gap-1 justify-between">
                {/* Basic formatting buttons */}
                <div className="flex items-center gap-1">
                    {basicFormatButtons.map((button, index) => {
                        const Icon = button.icon
                        return (
                            <button
                                key={index}
                                onClick={() => handleCommand(button.command)}
                                className={`p-2 rounded-md transition-all duration-150 ${
                                    button.active 
                                        ? 'bg-blue-100 text-blue-700 shadow-sm' 
                                        : 'hover:bg-gray-100 text-gray-700'
                                }`}
                                title={button.tooltip}
                            >
                                <Icon className="w-4 h-4" />
                            </button>
                        )
                    })}
                </div>

                {/* More options button */}
                <button
                    onClick={() => setShowMoreOptions(!showMoreOptions)}
                    className={`p-2 rounded-md transition-all duration-150 ${
                        showMoreOptions 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'hover:bg-gray-100 text-gray-700'
                    }`}
                    title="More options"
                >
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>

            {/* Expanded options */}
            {showMoreOptions && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-1 mb-2">
                        <span className="text-xs text-gray-600 mr-2">Align:</span>
                        {alignmentButtons.map((button, index) => {
                            const Icon = button.icon
                            return (
                                <button
                                    key={index}
                                    onClick={() => handleCommand(button.command)}
                                    className={`p-2 rounded-md transition-all duration-150 ${
                                        button.active 
                                            ? 'bg-blue-100 text-blue-700 shadow-sm' 
                                            : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                                    title={button.tooltip}
                                >
                                    <Icon className="w-4 h-4" />
                                </button>
                            )
                        })}
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                onUndo()
                                setShowMoreOptions(false)
                            }}
                            disabled={!canUndo}
                            className="p-2 hover:bg-gray-100 rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
                            title="Undo"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                        </button>
                        <button
                            onClick={() => {
                                onRedo()
                                setShowMoreOptions(false)
                            }}
                            disabled={!canRedo}
                            className="p-2 hover:bg-gray-100 rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
                            title="Redo"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                            </svg>
                        </button>
                        <button
                            onClick={() => {
                                onAIClick?.()
                                setShowMoreOptions(false)
                            }}
                            className="p-2 hover:bg-blue-50 rounded-md transition-all duration-150 text-blue-600"
                            title="AI Assistant"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
