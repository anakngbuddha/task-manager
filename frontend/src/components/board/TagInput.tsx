import { useState, useRef, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { useTags, useAddTaskTag, useRemoveTaskTag, type Tag } from '@/hooks/useTaskTags'

const MAX_TAG_LENGTH = 30

// Deterministic pastel colors from tag name — always same color for same tag
const TAG_COLORS = [
  { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', ring: 'ring-violet-300/50 dark:ring-violet-700/50' },
  { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-300/50 dark:ring-blue-700/50' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-300/50 dark:ring-emerald-700/50' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-300/50 dark:ring-amber-700/50' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-300/50 dark:ring-rose-700/50' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-700 dark:text-cyan-300', ring: 'ring-cyan-300/50 dark:ring-cyan-700/50' },
  { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300', ring: 'ring-pink-300/50 dark:ring-pink-700/50' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', ring: 'ring-orange-300/50 dark:ring-orange-700/50' },
]

export function getTagColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

interface TagPillProps {
  tag: Tag
  onRemove?: (tag: Tag) => void
  onClick?: (tag: Tag) => void
  size?: 'sm' | 'xs'
}

export function TagPill({ tag, onRemove, onClick, size = 'sm' }: TagPillProps) {
  const color = getTagColor(tag.name)
  const sizeClasses = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-[11px] px-2 py-0.5 gap-1'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-medium ring-1 transition-all select-none',
        color.bg, color.text, color.ring, sizeClasses,
        onClick ? 'cursor-pointer hover:opacity-80' : '',
      ].join(' ')}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(tag) } : undefined}
    >
      #{tag.name}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove tag ${tag.name}`}
          className="hover:opacity-70 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onRemove(tag) }}
        >
          <X className="size-2.5" />
        </button>
      )}
    </span>
  )
}

interface TagInputProps {
  taskId: string
  projectId: string
  currentTags: Tag[]
  readOnly?: boolean
}

export default function TagInput({ taskId, projectId, currentTags, readOnly = false }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const searchQuery = inputValue.trim().toLowerCase().slice(0, MAX_TAG_LENGTH)
  const { data: suggestions = [] } = useTags(searchQuery || undefined)
  const addTag = useAddTaskTag()
  const removeTag = useRemoveTaskTag()

  // Filter out already-added tags from suggestions
  const filteredSuggestions = suggestions.filter(
    (t) => !currentTags.some((ct) => ct.id === t.id)
  )

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const commitTag = useCallback(async (nameOrTag: string | Tag) => {
    const name = typeof nameOrTag === 'string' ? nameOrTag.trim().toLowerCase() : nameOrTag.name
    if (!name || name.length > MAX_TAG_LENGTH) return
    if (currentTags.some((t) => t.name === name)) {
      setInputValue('')
      setIsOpen(false)
      return
    }
    setInputValue('')
    setIsOpen(false)
    await addTag.mutateAsync({ taskId, projectId, name })
  }, [addTag, taskId, projectId, currentTags])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        commitTag(filteredSuggestions[highlightedIndex])
      } else if (inputValue.trim()) {
        commitTag(inputValue)
      }
      setHighlightedIndex(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
    } else if (e.key === 'Backspace' && !inputValue && currentTags.length > 0) {
      const last = currentTags[currentTags.length - 1]
      removeTag.mutate({ taskId, tagId: last.id, projectId })
    }
  }

  if (readOnly) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {currentTags.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">No tags</span>
        ) : (
          currentTags.map((tag) => <TagPill key={tag.id} tag={tag} />)
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 min-h-[38px] w-full items-center rounded-none border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {currentTags.map((tag) => (
          <TagPill
            key={tag.id}
            tag={tag}
            onRemove={(t) => removeTag.mutate({ taskId, tagId: t.id, projectId })}
          />
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          maxLength={MAX_TAG_LENGTH}
          placeholder={currentTags.length === 0 ? 'Add tags… (Enter or comma to confirm)' : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-xs placeholder:text-muted-foreground"
          onChange={(e) => {
            const v = e.target.value
            // Strip commas from input, treating them as separators
            if (v.endsWith(',')) {
              const name = v.slice(0, -1).trim()
              if (name) commitTag(name)
              return
            }
            setInputValue(v)
            setIsOpen(v.trim().length > 0)
            setHighlightedIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim()) setIsOpen(true)
          }}
        />
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-auto border border-border bg-background text-sm shadow-md"
        >
          {filteredSuggestions.slice(0, 10).map((tag, i) => {
            const color = getTagColor(tag.name)
            return (
              <button
                key={tag.id}
                type="button"
                className={[
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors',
                  i === highlightedIndex ? 'bg-accent' : 'hover:bg-accent/50',
                ].join(' ')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commitTag(tag)
                }}
              >
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${color.bg} ${color.text}`}>
                  #{tag.name}
                </span>
              </button>
            )
          })}
          {inputValue.trim() && !filteredSuggestions.some(t => t.name === inputValue.trim().toLowerCase()) && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/50 border-t border-border/40 text-xs text-muted-foreground"
              onMouseDown={(e) => {
                e.preventDefault()
                commitTag(inputValue.trim())
              }}
            >
              <span>Create tag</span>
              <span className="font-semibold text-foreground">#{inputValue.trim().toLowerCase()}</span>
            </button>
          )}
        </div>
      )}

      {isOpen && filteredSuggestions.length === 0 && inputValue.trim() && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-50 mt-1 border border-border bg-background text-sm shadow-md"
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/50 text-xs text-muted-foreground"
            onMouseDown={(e) => {
              e.preventDefault()
              commitTag(inputValue.trim())
            }}
          >
            <span>Create tag</span>
            <span className="font-semibold text-foreground">#{inputValue.trim().toLowerCase()}</span>
          </button>
        </div>
      )}
    </div>
  )
}
