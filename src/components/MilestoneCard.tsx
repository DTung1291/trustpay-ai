import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, FileSearch, GitCommit, Scale, Send } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { sendRequestVerification, sendSubmitDeliverable } from '@/lib/contract'
import { formatTimestamp } from '@/lib/stats'
import type { Agreement, Milestone } from '@/lib/types'
import {
  isGithubEvidence,
  LIMITS,
  shortAddress,
  validateEvidenceSubmission,
} from '@/lib/validation'
import { Badge, ErrorNote, MilestoneBadge, Spinner } from './ui'

interface Props {
  contract: string
  me: string
  agreement: Agreement
  milestone: Milestone
  isClient: boolean
  isFreelancer: boolean
  onChanged: () => void
}

export function MilestoneCard({ contract, me, agreement, milestone: m, isClient, isFreelancer, onChanged }: Props) {
  const { run, isBusy, txs } = useTransactions()
  const [url, setUrl] = useState('')
  const [sha, setSha] = useState('')
  const [error, setError] = useState<string | null>(null)

  const active = agreement.status === 'ACTIVE'
  const submitKey = `submit:${agreement.id}:${m.index}`
  const verifyKey = `verify:${agreement.id}:${m.index}`
  const submitBusy = isBusy(submitKey)
  const verifyBusy = isBusy(verifyKey)
  const verifyTx = txs.find((t) => t.key === verifyKey)

  const canSubmit = active && isFreelancer && m.status === 'AWAITING_EVIDENCE' && m.roundsUsed < m.maxRounds
  const canVerify = active && (isClient || isFreelancer) && m.status === 'EVIDENCE_SUBMITTED'
  const roundsLeft = Math.max(0, m.maxRounds - m.roundsUsed)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validateEvidenceSubmission(url, sha)
    setError(problem)
    if (problem) return
    void run({
      key: submitKey,
      label: `Submit evidence for "${m.title}"`,
      send: () => sendSubmitDeliverable(contract, me, { id: agreement.id, index: m.index, url, commitSha: sha }),
      onProgress: () => {
        onChanged()
        setUrl('')
        setSha('')
      },
    })
  }

  const verify = () =>
    void run({
      key: verifyKey,
      label: `AI verification for "${m.title}"`,
      send: () => sendRequestVerification(contract, me, agreement.id, m.index),
      onProgress: onChanged,
    })

  return (
    <article className="glass p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
            Milestone {m.index + 1}
          </p>
          <h3 className="text-xl font-semibold text-white">{m.title}</h3>
        </div>
        <MilestoneBadge status={m.status} />
      </header>

      <div className="mb-4">
        <p className="label">Acceptance criteria</p>
        <ol className="space-y-1.5 text-sm text-slate-200">
          {m.criteria.map((c, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 font-mono text-xs text-cyanx-400">{i + 1}.</span>
              <span className="break-words">{c}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-4">
        <p className="label">Evidence history</p>
        {m.submissions.length === 0 ? (
          <p className="text-sm text-slate-500">No evidence submitted yet.</p>
        ) : (
          <ul className="space-y-2">
            {m.submissions.map((s, i) => (
              <li key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="violet">Round {s.round}</Badge>
                  {isGithubEvidence(s.url) && <Badge tone="cyan">GitHub</Badge>}
                  <span className="text-xs text-slate-500">{formatTimestamp(s.submittedAt)}</span>
                </div>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 flex items-center gap-1.5 break-all text-cyanx-300 hover:underline">
                  {s.url}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </a>
                {s.commitSha && (
                  <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-slate-400">
                    <GitCommit className="h-3.5 w-3.5" aria-hidden />
                    {s.commitSha}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">by {shortAddress(s.submittedBy)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canSubmit && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl border border-white/10 bg-ink-900/60 p-4">
          <p className="text-sm font-medium text-white">
            Submit evidence <span className="font-normal text-slate-400">({roundsLeft} round{roundsLeft === 1 ? '' : 's'} left)</span>
          </p>
          <div>
            <label htmlFor={`url-${m.index}`} className="label">Immutable GitHub file URL</label>
            <input id={`url-${m.index}`} className="field" value={url} maxLength={LIMITS.url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/org/repo/blob/&lt;40-char-sha&gt;/README.md" inputMode="url" />
          </div>
          <div>
            <label htmlFor={`sha-${m.index}`} className="label">Full commit SHA</label>
            <input id={`sha-${m.index}`} className="field font-mono" value={sha} maxLength={40} onChange={(e) => setSha(e.target.value)} placeholder="40 hexadecimal characters" spellCheck={false} />
          </div>
          {error && <ErrorNote message={error} />}
          <button type="submit" className="btn-primary" disabled={submitBusy}>
            {submitBusy ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
            Submit evidence
          </button>
        </form>
      )}

      {m.status === 'AWAITING_EVIDENCE' && !canSubmit && (
        <p className="mb-4 text-sm text-slate-400">
          {!active
            ? 'The freelancer must accept the agreement before evidence can be submitted.'
            : isFreelancer
              ? 'No evidence rounds remain for this milestone.'
              : 'Waiting for the freelancer to submit evidence.'}
        </p>
      )}

      {m.status === 'VERIFYING' && (
        <p className="mb-4 flex items-center gap-2 text-sm text-cyanx-300">
          <Spinner /> Verification is in progress. Validators are evaluating the evidence.
        </p>
      )}

      {verifyTx?.phase === 'failed' && verifyTx.error && (
        <div className="mb-4">
          <ErrorNote message={verifyTx.error} />
        </div>
      )}

      <footer className="flex flex-wrap gap-2">
        {canVerify && (
          <button type="button" className="btn-primary" onClick={verify} disabled={verifyBusy}>
            {verifyBusy ? <Spinner /> : <Scale className="h-4 w-4" aria-hidden />}
            Request AI verification
          </button>
        )}
        {m.verifiedRounds > 0 && (
          <Link to={`/agreements/${agreement.id}/milestones/${m.index}/verification`} className="btn-ghost">
            <FileSearch className="h-4 w-4" aria-hidden />
            View verification{m.verifiedRounds > 1 ? ` (${m.verifiedRounds} rounds)` : ''}
          </Link>
        )}
      </footer>
    </article>
  )
}
