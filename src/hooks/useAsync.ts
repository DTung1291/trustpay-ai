import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data?: T
  error?: string
  loading: boolean
  reload: () => void
}

interface Result<T> {
  key: string
  token: string
  data?: T
  error?: string
}

/** Load async data whenever `key` changes. A null key means "do not load". */
export function useAsync<T>(key: string | null, load: () => Promise<T>): AsyncState<T> {
  const [result, setResult] = useState<Result<T>>()
  const [nonce, setNonce] = useState(0)
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  const token = key === null ? null : `${key}#${nonce}`

  useEffect(() => {
    if (key === null || token === null) return
    let cancelled = false
    loadRef
      .current()
      .then((data) => {
        if (!cancelled) setResult({ key, token, data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const error = err instanceof Error ? err.message : 'Failed to load contract data.'
        setResult((prev) => ({ key, token, data: prev?.key === key ? prev.data : undefined, error }))
      })
    return () => {
      cancelled = true
    }
  }, [key, token])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const current = result && result.key === key ? result : undefined
  return {
    data: current?.data,
    error: current?.error,
    loading: token !== null && result?.token !== token,
    reload,
  }
}
