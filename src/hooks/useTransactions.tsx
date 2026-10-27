import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchTransaction } from '@/lib/genlayer'
import { describeWalletError, trackTransaction, type TxPhase, type TxState } from '@/lib/tx'

interface RunArgs {
  /** Unique per action target. A second run with the same key is ignored while one is active. */
  key: string
  label: string
  send: () => Promise<string>
  /** Fired when the network first accepts the transaction, and again when it finalizes. */
  onProgress?: (phase: 'accepted' | 'finalized') => void
}

interface TxValue {
  txs: TxState[]
  isBusy: (key: string) => boolean
  run: (args: RunArgs) => Promise<void>
  dismiss: (key: string) => void
}

const TxContext = createContext<TxValue | null>(null)

const ACTIVE: TxPhase[] = ['signing', 'pending', 'consensus', 'accepted']

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const [txs, setTxs] = useState<TxState[]>([])
  const inFlight = useRef(new Set<string>())

  const patch = useCallback((key: string, startedAt: number, p: Partial<TxState>) => {
    setTxs((prev) =>
      prev.map((t) => (t.key === key && t.startedAt === startedAt ? { ...t, ...p, updatedAt: Date.now() } : t)),
    )
  }, [])

  const run = useCallback(
    async ({ key, label, send, onProgress }: RunArgs) => {
      if (inFlight.current.has(key)) return // duplicate submission guard
      inFlight.current.add(key)
      const startedAt = Date.now()
      setTxs((prev) => [
        { key, label, phase: 'signing', startedAt, updatedAt: startedAt },
        ...prev.filter((t) => t.key !== key),
      ])
      try {
        let hash: string
        try {
          hash = await send()
        } catch (err) {
          patch(key, startedAt, { phase: 'failed', error: describeWalletError(err) })
          return
        }
        patch(key, startedAt, { phase: 'pending', hash })
        const fired = new Set<string>()
        await trackTransaction(hash, {
          fetchTx: (h: string) => fetchTransaction(h),
          onUpdate: (u) => {
            patch(key, startedAt, u)
            if ((u.phase === 'accepted' || u.phase === 'finalized') && !fired.has(u.phase)) {
              fired.add(u.phase)
              onProgress?.(u.phase)
            }
          },
        })
      } finally {
        inFlight.current.delete(key)
      }
    },
    [patch],
  )

  const isBusy = useCallback(
    (key: string) => txs.some((t) => t.key === key && ACTIVE.includes(t.phase) && inFlight.current.has(key)),
    [txs],
  )

  const dismiss = useCallback((key: string) => setTxs((prev) => prev.filter((t) => t.key !== key)), [])

  const value = useMemo(() => ({ txs, isBusy, run, dismiss }), [txs, isBusy, run, dismiss])
  return <TxContext.Provider value={value}>{children}</TxContext.Provider>
}

export function useTransactions(): TxValue {
  const ctx = useContext(TxContext)
  if (!ctx) throw new Error('useTransactions must be used inside TransactionsProvider')
  return ctx
}
