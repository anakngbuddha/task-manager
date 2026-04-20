import type { ParsedCommand } from './commandTypes'

/**
 * Tokenize a raw terminal input string into a ParsedCommand.
 *
 * Handles:
 *   - Quoted strings:  --title="Hello World"  or  'Hello World'
 *   - Long flags:      --key=value  or  --flag (boolean true)
 *   - Positional args: everything that's not a flag
 *   - Ignores leading/trailing whitespace
 *
 * Examples:
 *   "ls tasks/todo"                     → { command:'ls', args:['tasks/todo'], flags:{} }
 *   "cat file.json"                     → { command:'cat', args:['file.json'], flags:{} }
 *   "find tasks/ --priority=HIGH"       → { command:'find', args:['tasks/'], flags:{priority:'HIGH'} }
 *   'touch tasks/todo/x.json --title="Buy milk" --priority=HIGH'
 *                                       → { command:'touch', args:['tasks/todo/x.json'], flags:{title:'Buy milk',priority:'HIGH'} }
 */
export function parseCommand(raw: string): ParsedCommand {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { command: '', args: [], flags: {}, raw }
  }

  const tokens = tokenize(trimmed)
  const [command, ...rest] = tokens

  const args: string[] = []
  const flags: Record<string, string | true> = {}

  for (const token of rest) {
    if (token.startsWith('--')) {
      const eqIdx = token.indexOf('=')
      if (eqIdx !== -1) {
        const key = token.slice(2, eqIdx)
        const value = token.slice(eqIdx + 1)
        flags[key] = value
      } else {
        // boolean flag
        flags[token.slice(2)] = true
      }
    } else if (token.startsWith('-') && token.length === 2) {
      // Short flag like -l  (boolean)
      flags[token.slice(1)] = true
    } else {
      args.push(token)
    }
  }

  return { command: command ?? '', args, flags, raw }
}

/**
 * Tokenizer: splits a string respecting single and double quoted regions.
 * Quoted content is returned as a single token (quotes stripped).
 */
function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    // BUG-25 fix: handle escaped characters (like \") inside quotes
    if (ch === '\\' && i + 1 < input.length) {
      current += input[i + 1]
      i++
      continue
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      continue
    }

    if (ch === '"' && !inSingle) {
      // Check if this is part of --flag="value"
      if (!inDouble && current.endsWith('=')) {
        inDouble = true
        continue
      }
      if (inDouble) {
        inDouble = false
        continue
      }
      inDouble = !inDouble
      continue
    }

    if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += ch
  }

  if (current) tokens.push(current)

  return tokens
}
