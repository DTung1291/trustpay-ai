import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ExternalLink, X, XCircle } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { explorerTxUrl } from '@/lib/genlayer'
import { PHASE_LABEL, type TxState } from '@/lib/tx'
import { shortAddress } from '@/lib/validation'
import { Spinner } from './ui'

const STEPS: TxState['phase'][] = ['signing', 'pending', 'consensus', 'accepted', 'finalized']

function Steps({ phase }: { phase: TxState['phase'] }) {
  const at = STEPS.indexOf(phase)
  return (
    <div className="mt-3 flex gap-1" aria-hidden>
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={`h-1 flex-1 rounded-full ${
            phase === 'failed' ? 'bg-rose-500/40' : i <= at ? 'bg-cyanx-400' : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  )
}

function TxCard({ tx, onDismiss }: { tx: TxState; onDismiss: () => void }) {
  const done = tx.phase === 'finalized'
  const failed = tx.phase === 'failed'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="glass w-full bg-ink-900/90 p-4"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5">
          {failed ? (
            <XCircle className="h-5 w-5 text-rose-400" aria-hidden />
          ) : done ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden />
          ) : (
            <Spinner className="h-5 w-5 text-cyanx-400" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{tx.label}</p>
          <p className="text-xs text-slate-400">
            {PHASE_LABEL[tx.phase]}
            {tx.statusName ? ` (${tx.statusName})` : ''}
          </p>
          {tx.error && <p className="mt-1.5 break-words text-xs text-rose-300">{tx.error}</p>}
          {tx.hash && (
            <a
              href={explorerTxUrl(tx.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 font-mono text-xs text-cyanx-300 hover:underline"
            >
              {shortAddress(tx.hash)}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
        {(done || failed) && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Steps phase={tx.phase} />
    </motion.div>
  )
}

export function TxPanel() {
  const { txs, dismiss } = useTransactions()
  return (
    <div className="pointer-events-none fixed bottom-16 left-4 sm:bottom-4 right-4 z-40 flex flex-col gap-2 sm:right-auto sm:w-96">
      <AnimatePresence initial={false}>
        {txs.slice(0, 3).map((tx) => (
          <div key={tx.key} className="pointer-events-auto">
            <TxCard tx={tx} onDismiss={() => dismiss(tx.key)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
