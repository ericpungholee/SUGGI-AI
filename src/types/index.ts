// Editor Types
export interface FormatState {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    subscript: boolean;
    superscript: boolean;
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontFamily: string;
    alignment: string;
    listType: string;
    headingLevel: string;
}

export interface ToolbarButton {
    icon: React.ComponentType<{ className?: string }>;
    command: string;
    value?: string;
    tooltip: string;
    shortcut?: string;
    needsInput?: boolean;
    active: boolean;
}

export interface EditorProps {
    documentId: string;
    onContentChange?: (content: string) => void;
}

export interface ToolbarProps {
    position: { top: number; left: number };
    onFormat: (command: string, value?: string) => void;
    formatState: FormatState;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onAIClick?: () => void;
}

// Document Types
export interface Document {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
    category?: string;
}

export interface DocumentMetadata {
    id: string;
    title: string;
    excerpt: string;
    wordCount: number;
    charCount: number;
    paragraphCount: number;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
    category?: string;
}

// Formatting Commands
export type FormatCommand = 
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikeThrough'
    | 'subscript'
    | 'superscript'
    | 'insertUnorderedList'
    | 'insertOrderedList'
    | 'justifyLeft'
    | 'justifyCenter'
    | 'justifyRight'
    | 'justifyFull'
    | 'formatBlock'
    | 'createLink'
    | 'backColor'
    | 'foreColor'
    | 'fontSize'
    | 'fontFamily';

// Font Options
export interface FontOption {
    name: string;
    value: string;
    category: 'serif' | 'sans-serif' | 'monospace' | 'display' | 'handwriting';
}

export const FONT_OPTIONS: FontOption[] = [
    { name: 'Georgia', value: 'Georgia, serif', category: 'serif' },
    { name: 'Times New Roman', value: 'Times New Roman, serif', category: 'serif' },
    { name: 'Arial', value: 'Arial, sans-serif', category: 'sans-serif' },
    { name: 'Helvetica', value: 'Helvetica, sans-serif', category: 'sans-serif' },
    { name: 'Verdana', value: 'Verdana, sans-serif', category: 'sans-serif' },
    { name: 'Courier New', value: 'Courier New, monospace', category: 'monospace' },
    { name: 'Monaco', value: 'Monaco, monospace', category: 'monospace' },
    { name: 'Brush Script MT', value: 'Brush Script MT, cursive', category: 'handwriting' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive', category: 'handwriting' }
];

// Color Options
export interface ColorOption {
    name: string;
    value: string;
    category: 'basic' | 'warm' | 'cool' | 'neutral' | 'accent';
}

export const COLOR_OPTIONS: ColorOption[] = [
    // Basic colors
    { name: 'Black', value: '#000000', category: 'basic' },
    { name: 'White', value: '#FFFFFF', category: 'basic' },
    { name: 'Red', value: '#FF0000', category: 'basic' },
    { name: 'Green', value: '#00FF00', category: 'basic' },
    { name: 'Blue', value: '#0000FF', category: 'basic' },
    
    // Warm colors
    { name: 'Red', value: '#DC2626', category: 'warm' },
    { name: 'Orange', value: '#EA580C', category: 'warm' },
    { name: 'Yellow', value: '#CA8A04', category: 'warm' },
    { name: 'Pink', value: '#EC4899', category: 'warm' },
    
    // Cool colors
    { name: 'Blue', value: '#2563EB', category: 'cool' },
    { name: 'Indigo', value: '#6366F1', category: 'cool' },
    { name: 'Purple', value: '#9333EA', category: 'cool' },
    { name: 'Teal', value: '#0D9488', category: 'cool' },
    
    // Neutral colors
    { name: 'Gray', value: '#6B7280', category: 'neutral' },
    { name: 'Slate', value: '#64748B', category: 'neutral' },
    { name: 'Stone', value: '#78716C', category: 'neutral' },
    { name: 'Zinc', value: '#71717A', category: 'neutral' }
];

// Font Size Options
export const FONT_SIZE_OPTIONS = [
    { name: 'Extra Small', value: '12px' },
    { name: 'Small', value: '14px' },
    { name: 'Base', value: '16px' },
    { name: 'Large', value: '18px' },
    { name: 'Extra Large', value: '20px' },
    { name: '2XL', value: '24px' },
    { name: '3XL', value: '28px' },
    { name: '4XL', value: '32px' },
    { name: '5XL', value: '36px' },
    { name: '6XL', value: '48px' }
];

// Keyboard Shortcuts
export interface KeyboardShortcut {
    command: FormatCommand;
    key: string;
    description: string;
    modifier?: 'ctrl' | 'shift' | 'alt' | 'meta' | 'ctrl+shift' | 'ctrl+alt' | 'shift+alt';
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
    { command: 'bold', key: 'B', description: 'Bold', modifier: 'ctrl' },
    { command: 'italic', key: 'I', description: 'Italic', modifier: 'ctrl' },
    { command: 'underline', key: 'U', description: 'Underline', modifier: 'ctrl' },
    { command: 'strikeThrough', key: 'X', description: 'Strikethrough', modifier: 'ctrl+shift' },
    { command: 'subscript', key: '=', description: 'Subscript', modifier: 'ctrl' },
    { command: 'superscript', key: '=', description: 'Superscript', modifier: 'ctrl+shift' },
    { command: 'createLink', key: 'K', description: 'Insert Link', modifier: 'ctrl' },
    { command: 'formatBlock', key: '1', description: 'Heading 1', modifier: 'ctrl' },
    { command: 'formatBlock', key: '2', description: 'Heading 2', modifier: 'ctrl' },
    { command: 'formatBlock', key: '3', description: 'Heading 3', modifier: 'ctrl' },
    { command: 'formatBlock', key: '4', description: 'Heading 4', modifier: 'ctrl' },
    { command: 'insertUnorderedList', key: 'L', description: 'Bullet List', modifier: 'ctrl+shift' },
    { command: 'insertOrderedList', key: 'O', description: 'Numbered List', modifier: 'ctrl+shift' },
    { command: 'justifyLeft', key: 'L', description: 'Align Left', modifier: 'ctrl' },
    { command: 'justifyCenter', key: 'E', description: 'Align Center', modifier: 'ctrl' },
    { command: 'justifyRight', key: 'R', description: 'Align Right', modifier: 'ctrl' },
    { command: 'justifyFull', key: 'J', description: 'Justify', modifier: 'ctrl' },
    { command: 'formatBlock', key: 'Q', description: 'Quote Block', modifier: 'ctrl+shift' },
    { command: 'formatBlock', key: 'K', description: 'Code Block', modifier: 'ctrl+shift' },
    { command: 'backColor', key: 'H', description: 'Highlight Text', modifier: 'ctrl+shift' }
];

// Editor State
export interface EditorState {
    content: string;
    selection: {
        start: number;
        end: number;
        text: string;
    } | null;
    formatState: FormatState;
    undoStack: string[];
    redoStack: string[];
    isDirty: boolean;
    lastSaved: Date | null;
}

// Toolbar Position
export interface ToolbarPosition {
    top: number;
    left: number;
    visible: boolean;
}

// AI Types
export interface AIMessage {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    metadata?: {
        documentId?: string;
        contextUsed?: string[];
        tokenUsage?: {
            prompt: number;
            completion: number;
            total: number;
        };
        cancelled?: boolean;
        editSuggestion?: {
            intent: string;
            shouldProposeEdit: boolean;
            originalMessage?: string;
        };
        toolCalls?: Array<{
            id: string;
            type: 'function';
            function: {
                name: string;
                arguments: any;
            };
        }>;
    };
}

export interface AIProposal {
    id: string;
    originalText: string;
    proposedText: string;
    reason: string;
    confidence: number;
    action: 'improve' | 'expand' | 'summarize' | 'rewrite';
}

export interface AIConversation {
    id: string;
    documentId?: string;
    lastMessage?: string;
    updatedAt: Date;
}

export interface DocumentProcessingStatus {
    isProcessed: boolean;
    chunkCount: number;
    lastProcessed?: Date;
}

export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
    source?: string;
}

// Edit Workflow Types
export interface EditRequest {
    documentId: string;
    scope: 'selection' | 'document';
    selectionPositions?: {
        start: number;
        end: number;
    };
    userIntent: string;
    guardrails: {
        allowCodeEdits: boolean;
        allowMathEdits: boolean;
        preserveVoice: boolean;
    };
}

export interface TextDiffHunk {
    from: number;
    to: number;
    replacement: string;
    blockId: string;
    label: string;
    changeType: 'grammar' | 'clarity' | 'tone' | 'structure' | 'content';
    sizeDelta: number;
}

export interface EditPatch {
    proposalId: string;
    hunks: TextDiffHunk[];
    summary: {
        blocksChanged: number;
        wordsAdded: number;
        wordsRemoved: number;
        totalChanges: number;
    };
    conflicts?: string[]; // Block IDs with conflicts
}

export interface EditProposal {
    id: string;
    documentId: string;
    originalContent: string;
    patch: EditPatch;
    status: 'streaming' | 'ready' | 'applied' | 'discarded';
    createdAt: Date;
    appliedAt?: Date;
}

export interface ApplyEditRequest {
    proposalId: string;
    blockIds?: string[]; // Empty = apply all
}

export interface ApplyEditResult {
    proposalId: string;
    blocksApplied: string[];
    wordsAdded: number;
    wordsRemoved: number;
    summary: string[];
    newContent: string;
}



// Export new agentic editing types
export * from './agentic-editing'



