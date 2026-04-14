import { useEffect, useRef, useState } from 'react'

interface TerminalInputProps {
  cwd: string
  projectName: string
  onSubmit: (value: string) => void
  historyUp: () => string | undefined
  historyDown: () => string | undefined
  disabled?: boolean
}

export default function TerminalInput({
  cwd,
  projectName,
  onSubmit,
  historyUp,
  historyDown,
  disabled = false,
}: TerminalInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input whenever terminal becomes enabled
  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = value.trim()
      if (trimmed) {
        onSubmit(trimmed)
        setValue('')
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = historyUp()
      if (prev !== undefined) setValue(prev)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = historyDown()
      if (next !== undefined) setValue(next)
      return
    }

    // Ctrl+L = clear (handled upstream as a command)
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      onSubmit('clear')
      setValue('')
    }
  }

  // Format the prompt: user@project:cwd$
  const prompt = `vfs@${projectName}:${cwd}$ `

  return (
    <div className="term-input-row" onClick={() => inputRef.current?.focus()}>
      <span className="term-prompt" aria-hidden="true">
        {prompt}
      </span>
      <input
        ref={inputRef}
        id="terminal-input"
        type="text"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        className="term-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label="Terminal command input"
        aria-describedby="terminal-output"
      />
    </div>
  )
}
