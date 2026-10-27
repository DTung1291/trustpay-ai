import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Clock, Loader2, XCircle } from 'lucide-react'
import clsx from 'clsx'
import type { AgreementStatus, MilestoneStatus, Outcome } from '@/lib/types'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-4 w-4 animate-spin', className)} aria-hidden />
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('glass p-5 sm:p-6', className)}>{children}</section>
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-cyanx-400">{eyebrow}</p>
        )}
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3.5 text-sm text-rose-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 break-words">{message}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
      <p className="font-display text-lg text-white">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-slate-400">{children}</div>}
    </div>
  )
}

const TONE = {
  neutral: 'border-white/10 bg-white/5 text-slate-300',
  cyan: 'border-cyanx-400/30 bg-cyanx-400/10 text-cyanx-300',
  violet: 'border-violetx-400/30 bg-violetx-400/10 text-violetx-400',
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  red: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
} as const

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONE; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium',
        TONE[tone],
      )}
    >
      {children}
    </span>
  )
}

const AGREEMENT_TONE: Record<AgreementStatus, keyof typeof TONE> = {
  PENDING_ACCEPTANCE: 'amber',
  ACTIVE: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'neutral',
}
const MILESTONE_TONE: Record<MilestoneStatus, keyof typeof TONE> = {
  AWAITING_EVIDENCE: 'neutral',
  EVIDENCE_SUBMITTED: 'violet',
  VERIFYING: 'cyan',
  APPROVED: 'green',
  REJECTED: 'red',
  INCONCLUSIVE: 'amber',
}

const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())

export const AgreementBadge = ({ status }: { status: AgreementStatus }) => (
  <Badge tone={AGREEMENT_TONE[status]}>{pretty(status)}</Badge>
)
export const MilestoneBadge = ({ status }: { status: MilestoneStatus }) => (
  <Badge tone={MILESTONE_TONE[status]}>
    {status === 'VERIFYING' && <Spinner className="h-3 w-3" />}
    {pretty(status)}
  </Badge>
)

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const map = {
    APPROVED: { tone: 'green', Icon: CheckCircle2 },
    REJECTED: { tone: 'red', Icon: XCircle },
    INCONCLUSIVE: { tone: 'amber', Icon: CircleHelp },
  } as const
  const { tone, Icon } = map[outcome]
  return (
    <Badge tone={tone}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {outcome}
    </Badge>
  )
}

export function StatCard({ label, value, icon, loading }: { label: string; value: number | string; icon: ReactNode; loading?: boolean }) {
  return (
    <div className="glass p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between text-slate-400">
        <span className="text-xs font-medium uppercase tracking-[0.08em]">{label}</span>
        {icon}
      </div>
      <p className="font-display text-3xl font-semibold tabular-nums tracking-[-0.03em] text-white">
        {loading ? <Clock className="h-6 w-6 animate-pulse text-slate-600" aria-label="Loading" /> : value}
      </p>
    </div>
  )
}
