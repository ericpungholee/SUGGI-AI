'use client'
import { useState } from 'react'
import { 
  EditProposal, 
  TextDiffHunk, 
  EditWorkflowState,
  ApplyEditResult 
} from '@/types'
import { 
  Check, 
  X, 
  Eye, 
  Settings, 
  AlertTriangle, 
  Loader2,
  Sparkles,
  FileText,
  Filter
} from 'lucide-react'

interface EditWorkflowCardsProps {
  state: EditWorkflowState
  proposal: EditProposal | null
  onAcceptAll: () => void
  onRejectAll: () => void
  onApplySelected: (blockIds: string[]) => void
  onDiscard: () => void
  onUndo: () => void
  conflicts?: string[]
}

export default function EditWorkflowCards({
  state,
  proposal,
  onAcceptAll,
  onRejectAll,
  onApplySelected,
  onDiscard,
  onUndo,
  conflicts = []
}: EditWorkflowCardsProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'grammar' | 'clarity' | 'tone' | 'structure' | 'content'>('all')

  // Show planning state even without proposal
  if (state === 'planning') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Analyzing document and planning edits...</span>
      </div>
    )
  }

  if (!proposal) {
    if (state === 'preview_streaming') {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Generating edit proposals...</span>
        </div>
      )
    }
    return null
  }

  const filteredHunks = proposal.patch.hunks.filter(hunk => 
    filter === 'all' || hunk.changeType === filter
  )

  const handleBlockToggle = (blockId: string) => {
    setSelectedBlocks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(blockId)) {
        newSet.delete(blockId)
      } else {
        newSet.add(blockId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    setSelectedBlocks(new Set(filteredHunks.map(hunk => hunk.blockId)))
  }

  const handleApplySelected = () => {
    onApplySelected(Array.from(selectedBlocks))
  }

  return (
    <div className="space-y-4">
      {/* Plan Card */}
      {state === 'planning' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-blue-600" />
            <h3 className="font-medium text-blue-900">Planning Edits</h3>
          </div>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• Analyzing document content and structure</p>
            <p>• Identifying areas for improvement</p>
            <p>• Preparing targeted edits</p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-700">Generating proposal...</span>
          </div>
        </div>
      )}

      {/* Proposal Card */}
      {(state === 'preview_streaming' || state === 'preview_ready') && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-gray-600" />
              <h3 className="font-medium text-gray-900">Edit Proposal</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {proposal.patch.summary.blocksChanged} changes
              </span>
              <span className="text-sm text-green-600">
                +{proposal.patch.summary.wordsAdded} words
              </span>
              <span className="text-sm text-red-600">
                -{proposal.patch.summary.wordsRemoved} words
              </span>
            </div>
          </div>

          {state === 'preview_streaming' && (
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
              <span className="text-sm text-gray-600">Generating preview...</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onAcceptAll}
              className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-2 text-sm"
            >
              <Check className="w-4 h-4" />
              Accept All
            </button>
            <button
              onClick={onRejectAll}
              className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2 text-sm"
            >
              <X className="w-4 h-4" />
              Reject All
            </button>
            <button
              onClick={() => {/* Show change list */}}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              Review Changes
            </button>
          </div>
        </div>
      )}

      {/* Change List Card */}
      {state === 'reviewing' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-600" />
              <h3 className="font-medium text-gray-900">Review Changes</h3>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="text-xs border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All</option>
                <option value="grammar">Grammar</option>
                <option value="clarity">Clarity</option>
                <option value="tone">Tone</option>
                <option value="structure">Structure</option>
                <option value="content">Content</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredHunks.map((hunk) => {
              const hasConflict = conflicts.includes(hunk.blockId)
              const isSelected = selectedBlocks.has(hunk.blockId)
              
              return (
                <div
                  key={hunk.blockId}
                  className={`p-3 rounded-lg border ${
                    hasConflict 
                      ? 'border-yellow-300 bg-yellow-50'
                      : isSelected
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleBlockToggle(hunk.blockId)}
                          className="rounded"
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {hunk.label}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          hunk.changeType === 'grammar' ? 'bg-blue-100 text-blue-800' :
                          hunk.changeType === 'clarity' ? 'bg-green-100 text-green-800' :
                          hunk.changeType === 'tone' ? 'bg-purple-100 text-purple-800' :
                          hunk.changeType === 'structure' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {hunk.changeType}
                        </span>
                        {hasConflict && (
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        )}
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        {hunk.replacement}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>
                          {hunk.sizeDelta > 0 ? '+' : ''}{hunk.sizeDelta} characters
                        </span>
                        {hasConflict && (
                          <span className="text-yellow-600">Content changed during preview</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              <span className="text-sm text-gray-500">
                {selectedBlocks.size} of {filteredHunks.length} selected
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onDiscard}
                className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleApplySelected}
                disabled={selectedBlocks.size === 0}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Apply Selected ({selectedBlocks.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Applied Card */}
      {state === 'applied' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-4 h-4 text-green-600" />
            <h3 className="font-medium text-green-900">Changes Applied</h3>
          </div>
          <div className="space-y-2 text-sm text-green-800">
            <p>• Edits have been successfully applied to your document</p>
            <p>• All changes are now part of your document content</p>
            <p>• You can undo these changes if needed</p>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onUndo}
              className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
            >
              Undo Changes
            </button>
            <button
              onClick={() => {/* Start new edit */}}
              className="px-3 py-2 bg-white text-green-700 rounded-lg hover:bg-green-50 transition-colors text-sm border border-green-300"
            >
              New Edit
            </button>
          </div>
        </div>
      )}

      {/* Discarded Card */}
      {state === 'discarded' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <X className="w-4 h-4 text-gray-600" />
            <h3 className="font-medium text-gray-900">Changes Discarded</h3>
          </div>
          <div className="space-y-2 text-sm text-gray-700">
            <p>• Edit proposal has been discarded</p>
            <p>• No changes were made to your document</p>
            <p>• You can start a new edit request anytime</p>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {/* Start new edit */}}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Start New Edit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
