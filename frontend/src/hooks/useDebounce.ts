import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Debounce a value. Returns the previous value until `delay` ms have passed
 * without a change.
 *
 * Use this for anything that keys a query or triggers a fetch from typing:
 *
 *   const [search, setSearch] = useState('')
 *   const debouncedSearch = useDebounce(search, 300)
 *   const { data } = useAuditLogs({ search: debouncedSearch })
 *
 * Keying a query on the raw input value creates a new cache entry and a new
 * request per keystroke, which is the pattern this exists to stop.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value)
      return
    }
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export interface DebouncedCallback<A extends unknown[]> {
  (...args: A): void
  /** Drop any pending invocation. */
  cancel: () => void
  /** Run any pending invocation immediately. */
  flush: () => void
}

/**
 * Debounce a callback. Prefer this for handlers with side effects (autosave,
 * resize/scroll work, imperative search) where you do not want the debounced
 * value in render state.
 *
 * The returned function is stable across renders, and always calls the latest
 * `fn` so it never closes over stale props.
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay = 300,
): DebouncedCallback<A> {
  const fnRef = useRef(fn)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingArgsRef = useRef<A | null>(null)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Never leave a timer running after unmount.
  useEffect(() => clear, [clear])

  const cancel = useCallback(() => {
    clear()
    pendingArgsRef.current = null
  }, [clear])

  const flush = useCallback(() => {
    clear()
    const args = pendingArgsRef.current
    pendingArgsRef.current = null
    if (args) fnRef.current(...args)
  }, [clear])

  const debounced = useCallback(
    (...args: A) => {
      pendingArgsRef.current = args
      clear()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        const pending = pendingArgsRef.current
        pendingArgsRef.current = null
        if (pending) fnRef.current(...pending)
      }, delay)
    },
    [clear, delay],
  ) as DebouncedCallback<A>

  debounced.cancel = cancel
  debounced.flush = flush

  return debounced
}

export default useDebounce
