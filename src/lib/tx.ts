export type TxPhase =
  | 'signing' // waiting for the wallet signature
  | 'pending' // submitted, queued for execution
  | 'consensus' // leader proposed, validators voting (including appeals)
  | 'accepted' // validators agreed, appeal window still open
  | 'finalized' // final, appeal window closed
  | 'failed'

export interface TxState {
  key: string
  label: string
  phase: TxPhase
  hash?: string
  statusName?: string
  error?: string
  startedAt: number
  updatedAt: number
}

export interface RawTx {
  statusName?: string
  txExecutionResultName?: string
}

const CONSENSUS_STATUSES = new Set([
  'PROPOSING',
  'COMMITTING',
  'REVEALING',
  'APPEAL_COMMITTING',
  'APPEAL_REVEALING',
])
const FAILED_STATUSES: Record<string, string> = {
  UNDETERMINED: 'Validators could not reach consensus (UNDETERMINED).',
  CANCELED: 'The transaction was canceled.',
  LEADER_TIMEOUT: 'The leader validator timed out.',
  VALIDATORS_TIMEOUT: 'Validators timed out before voting.',
}

export interface Classification {
  phase: TxPhase
  error?: string
  terminal: boolean
}

/** Pure mapping from a GenLayer transaction snapshot to an honest UI phase. */
export function classifyTx(tx: RawTx): Classification {
  const status = tx.statusName ?? 'PENDING'
  if (status in FAILED_STATUSES) {
    return { phase: 'failed', error: FAILED_STATUSES[status], terminal: true }
  }
  const settled = status === 'ACCEPTED' || status === 'READY_TO_FINALIZE' || status === 'FINALIZED'
  if (settled && tx.txExecutionResultName === 'FINISHED_WITH_ERROR') {
    return {
      phase: 'failed',
      error: 'The contract rejected this call (execution finished with an error).',
      terminal: true,
    }
  }
  if (status === 'FINALIZED') return { phase: 'finalized', terminal: true }
  if (status === 'ACCEPTED' || status === 'READY_TO_FINALIZE') return { phase: 'accepted', terminal: false }
  if (CONSENSUS_STATUSES.has(status)) return { phase: 'consensus', terminal: false }
  return { phase: 'pending', terminal: false }
}

export interface TrackOptions {
  intervalMs?: number
  timeoutMs?: number
  signal?: AbortSignal
  fetchTx: (hash: string) => Promise<RawTx>
  onUpdate: (patch: Pick<TxState, 'phase' | 'statusName' | 'error'>) => void
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      resolve()
    })
  })

/** Poll a transaction until it is final, failed, aborted, or the timeout passes. */
export async function trackTransaction(hash: string, opts: TrackOptions): Promise<TxPhase> {
  const interval = opts.intervalMs ?? 2500
  const deadline = Date.now() + (opts.timeoutMs ?? 15 * 60_000)
  let last: TxPhase = 'pending'
  while (Date.now() < deadline && !opts.signal?.aborted) {
    try {
      const tx = await opts.fetchTx(hash)
      const c = classifyTx(tx)
      last = c.phase
      opts.onUpdate({ phase: c.phase, statusName: tx.statusName, error: c.error })
      if (c.terminal) return c.phase
    } catch {
      // transient RPC error: keep polling until the deadline
    }
    await sleep(interval, opts.signal)
  }
  if (!opts.signal?.aborted && last !== 'accepted') {
    opts.onUpdate({
      phase: 'failed',
      error: 'Timed out waiting for the network. The transaction may still complete; check the explorer.',
    })
    return 'failed'
  }
  return last
}

export function describeWalletError(err: unknown): string {
  const e = err as { code?: number; message?: string; shortMessage?: string } | undefined
  if (e?.code === 4001 || /user rejected|denied/i.test(e?.message ?? '')) {
    return 'Signature rejected in your wallet.'
  }
  return e?.shortMessage ?? e?.message ?? 'Unknown error.'
}

export const PHASE_LABEL: Record<TxPhase, string> = {
  signing: 'Waiting for wallet signature',
  pending: 'Submitted, waiting for execution',
  consensus: 'Validators are reaching consensus',
  accepted: 'Accepted by validators (appeal window open)',
  finalized: 'Finalized',
  failed: 'Failed',
}
