import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, CircleHelp, ExternalLink, GitCommit, ShieldAlert, XCircle } from 'lucide-react'
import { useContract } from '@/hooks/useContract'
import { useAsync } from '@/hooks/useAsync'
import { useTransactions } from '@/hooks/useTransactions'
import { getAgreement, getMilestone, getVerificationHistory } from '@/lib/contract'
import { explorerTxUrl } from '@/lib/genlayer'
import { formatTimestamp } from '@/lib/stats'
import { PHASE_LABEL } from '@/lib/tx'
import type { CriterionMet, Verification } from '@/lib/types'
import { isGithubEvidence, shortAddress } from '@/lib/validation'
import { Badge, Card, Empty, ErrorNote, MilestoneBadge, OutcomeBadge, Spinner } from '@/components/ui'

function MetIcon({ met }: { met: CriterionMet }) {
  if (met === true) return <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-label="Met" />
  if (met === false) return <XCircle className="h-5 w-5 text-rose-400" aria-label="Not met" />
  return <CircleHelp className="h-5 w-5 text-amber-300" aria-label="Unclear" />
}

function RoundView({ v, criteria }: { v: Verification; criteria: string[] }) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <OutcomeBadge outcome={v.outcome} />
          <span className="text-xs text-slate-500">Round {v.round}</span>
          <span className="text-xs text-slate-500">Finalized {formatTimestamp(v.finalizedAt)}</span>
        </div>
        <p className="label">Decision reasoning</p>
        {/* Rendered as plain text on purpose: model output is never treated as markup. */}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
          {v.summary || 'The contract stored no summary for this round.'}
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-white">Criterion by criterion</h2>
        {v.criteriaResults.length === 0 ? (
          <p className="text-sm text-slate-400">No per-criterion results were stored.</p>
        ) : (
          <ul className="space-y-3">
            {v.criteriaResults.map((r) => (
              <li key={r.criterionIndex} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <MetIcon met={r.met} />
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-white">
                    {criteria[r.criterionIndex] ?? `Criterion ${r.criterionIndex + 1}`}
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-400">{r.reason || 'No reason stored.'}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-white">Evidence evaluated</h2>
        <a href={v.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 break-all text-sm text-cyanx-300 hover:underline">
          {v.evidenceUrl}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </a>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          {isGithubEvidence(v.evidenceUrl) ? <Badge tone="cyan">GitHub source</Badge> : <Badge tone="amber">Non-GitHub host</Badge>}
          {v.evidenceCommitSha && (
            <span className="inline-flex items-center gap-1 font-mono">
              <GitCommit className="h-3.5 w-3.5" aria-hidden />
              {v.evidenceCommitSha}
            </span>
          )}
          <span>Requested by {shortAddress(v.requestedBy)} on {formatTimestamp(v.requestedAt)}</span>
        </div>
      </Card>
    </div>
  )
}

export function VerificationResults() {
  const params = useParams()
  const id = Number(params.id)
  const index = Number(params.index)
  const valid = Number.isInteger(id) && Number.isInteger(index) && id >= 0 && index >= 0
  const { address: contract } = useContract()
  const { txs } = useTransactions()
  const [selected, setSelected] = useState<number>()

  const { data, error, reload } = useAsync(valid && contract ? `${contract}:${id}:${index}` : null, async () => {
    const [agreement, milestone] = await Promise.all([getAgreement(contract!, id), getMilestone(contract!, id, index)])
    const history = await getVerificationHistory(contract!, id, milestone)
    return { agreement, milestone, history }
  })

  if (!valid) return <ErrorNote message="That milestone link is not valid." />
  if (error && !data) return <ErrorNote message={error} onRetry={reload} />
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Spinner /> Loading verification...
      </div>
    )
  }

  const { agreement, milestone, history } = data
  const round = history.find((h) => h.round === selected) ?? history[history.length - 1]
  const verifyTx = txs.find((t) => t.key === `verify:${id}:${index}` && t.hash)

  return (
    <>
      <Link to={`/agreements/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {agreement.title}
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-cyanx-400">AI verification result</p>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">{milestone.title}</h1>
        </div>
        <MilestoneBadge status={milestone.status} />
      </div>

      {history.length === 0 || !round ? (
        <Empty title="No finalized verification yet">
          {milestone.status === 'VERIFYING'
            ? 'Validators are still evaluating this milestone. This page does not show a result until the contract stores one.'
            : 'Request verification from the agreement page once evidence is submitted.'}
        </Empty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
          <div>
            {history.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Verification rounds">
                {history.map((h) => (
                  <button
                    key={h.round}
                    role="tab"
                    aria-selected={h.round === round.round}
                    type="button"
                    onClick={() => setSelected(h.round)}
                    className={`btn ${h.round === round.round ? 'bg-white/10 text-white' : 'border border-white/10 text-slate-400'}`}
                  >
                    Round {h.round}: {h.outcome}
                  </button>
                ))}
              </div>
            )}
            <RoundView v={round} criteria={milestone.criteria} />
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-white">Consensus record</h2>
              <p className="text-sm leading-relaxed text-slate-300">
                This decision is stored in the contract after validators independently evaluated the same evidence
                against the locked criteria.
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="label">Rounds used</dt>
                  <dd className="tabular-nums text-slate-200">{milestone.roundsUsed} of {milestone.maxRounds}</dd>
                </div>
                {verifyTx?.hash ? (
                  <div>
                    <dt className="label">Transaction (this session)</dt>
                    <dd>
                      <a href={explorerTxUrl(verifyTx.hash)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-cyanx-300 hover:underline">
                        {shortAddress(verifyTx.hash)} <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                      <p className="mt-1 text-xs text-slate-400">{PHASE_LABEL[verifyTx.phase]}</p>
                    </dd>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Transaction details appear here for verifications you start in this browser session. Find earlier ones in the explorer.
                  </p>
                )}
              </dl>
            </Card>
            {round.outcome === 'INCONCLUSIVE' && (
              <div className="flex gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
                <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />
                The evidence was not enough to decide. The freelancer can submit clearer evidence if rounds remain.
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
