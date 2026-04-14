import { useEffect, useRef } from 'react'

export type OutputLineType =
  | 'stdout'
  | 'stderr'
  | 'system'
  | 'success'
  | 'echo'
  | 'empty'
  | 'banner'
  | 'table'
  | 'json'

export interface OutputLine {
  id: string
  type: OutputLineType
  /** Raw text or, for 'json' type, a pre-rendered HTML string */
  content: string
  /** If true, content is already safe HTML (json/table). */
  html?: boolean
}

interface TerminalOutputProps {
  lines: OutputLine[]
}

/**
 * Syntax-highlights a JSON value into HTML spans.
 * Handles strings, numbers, booleans, null, arrays, and objects.
 */
function highlight(json: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)

  if (json === null) {
    return `<span class="term-json-null">null</span>`
  }
  if (typeof json === 'boolean') {
    return `<span class="term-json-bool">${json}</span>`
  }
  if (typeof json === 'number') {
    return `<span class="term-json-num">${json}</span>`
  }
  if (typeof json === 'string') {
    const escaped = json.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<span class="term-json-str">"${escaped}"</span>`
  }
  if (Array.isArray(json)) {
    if (json.length === 0) return '[]'
    const items = json.map((v) => `${padInner}${highlight(v, indent + 1)}`).join(',\n')
    return `[\n${items}\n${pad}]`
  }
  if (typeof json === 'object') {
    const entries = Object.entries(json as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    const items = entries
      .map(
        ([k, v]) =>
          `${padInner}<span class="term-json-key">"${k}"</span>: ${highlight(v, indent + 1)}`
      )
      .join(',\n')
    return `{\n${items}\n${pad}}`
  }
  return String(json)
}

/** Renders a JSON OutputLine with syntax highlighting */
function JsonLine({ content }: { content: string }) {
  try {
    const parsed = JSON.parse(content)
    const html = highlight(parsed)
    return (
      <p
        className="term-line term-line--stdout"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  } catch {
    return <p className="term-line term-line--stderr">{content}</p>
  }
}

/** Renders a pre-built HTML table line */
function TableLine({ content }: { content: string }) {
  return (
    <div
      className="term-line term-line--stdout"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

export default function TerminalOutput({ lines }: TerminalOutputProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom whenever lines change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="term-output" role="log" aria-live="polite" aria-label="Terminal output">
      {lines.map((line) => {
        if (line.type === 'json') return <JsonLine key={line.id} content={line.content} />
        if (line.type === 'table') return <TableLine key={line.id} content={line.content} />
        if (line.type === 'empty') return <div key={line.id} className="term-line term-line--empty" />

        return (
          <p key={line.id} className={`term-line term-line--${line.type}`}>
            {line.content}
          </p>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
