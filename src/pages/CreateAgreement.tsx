import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Lock, Plus, Send, Trash2 } from 'lucide-react'
import { useContract } from '@/hooks/useContract'
import { useWallet } from '@/hooks/useWallet'
import { useTransactions } from '@/hooks/useTransactions'
import { sendCreateAgreement } from '@/lib/contract'
import {
  LIMITS,
  serializeMilestones,
  validateAgreementForm,
  type AgreementFormInput,
} from '@/lib/validation'
import { Card, ErrorNote, SectionTitle, Spinner } from '@/components/ui'

type Draft = { title: string; criteria: string[] }
const emptyMilestone = (): Draft => ({ title: '', criteria: [''] })

export function CreateAgreement() {
  const { address: contract } = useContract()
  const { address: me } = useWallet()
  const { run, isBusy, txs } = useTransactions()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [freelancer, setFreelancer] = useState('')
  const [milestones, setMilestones] = useState<Draft[]>([emptyMilestone()])
  const [formError, setFormError] = useState<string | null>(null)

  const key = `create:${me}`
  const busy = isBusy(key)
  const lastTx = txs.find((t) => t.key === key)
  const created = lastTx && (lastTx.phase === 'accepted' || lastTx.phase === 'finalized')

  const updateMilestone = (i: number, patch: Partial<Draft>) =>
    setMilestones((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const input: AgreementFormInput = { title, description, freelancer, milestones }
    const problem = validateAgreementForm(input, me)
    setFormError(problem)
    if (problem || !contract || !me) return
    void run({
      key,
      label: `Create agreement "${title.trim()}"`,
      send: () =>
        sendCreateAgreement(contract, me, {
          title,
          description,
          freelancer,
          milestonesJson: serializeMilestones(milestones),
        }),
    })
  }

  return (
    <>
      <SectionTitle eyebrow="Client" title="Create agreement" />

      {created && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1">
            The validators accepted your agreement. It now waits for the freelancer to accept it.
          </span>
          <Link to="/" className="btn-ghost">
            View dashboard
          </Link>
        </div>
      )}

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card className="space-y-4">
            <div>
              <label htmlFor="title" className="label">Project title</label>
              <input id="title" className="field" value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} placeholder="Landing page rebuild" />
            </div>
            <div>
              <label htmlFor="desc" className="label">Description</label>
              <textarea id="desc" className="field min-h-28" value={description} maxLength={LIMITS.description} onChange={(e) => setDescription(e.target.value)} placeholder="What is being built, and for whom?" />
            </div>
            <div>
              <label htmlFor="freelancer" className="label">Freelancer wallet</label>
              <input id="freelancer" className="field font-mono" value={freelancer} onChange={(e) => setFreelancer(e.target.value)} placeholder="0x..." autoComplete="off" spellCheck={false} />
            </div>
          </Card>

          {milestones.map((m, i) => (
            <Card key={i} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Milestone {i + 1}</h2>
                {milestones.length > 1 && (
                  <button type="button" aria-label={`Remove milestone ${i + 1}`} className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-rose-300" onClick={() => setMilestones((ms) => ms.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div>
                <label htmlFor={`mt-${i}`} className="label">Title</label>
                <input id={`mt-${i}`} className="field" value={m.title} maxLength={LIMITS.milestoneTitle} onChange={(e) => updateMilestone(i, { title: e.target.value })} placeholder="Responsive homepage shipped" />
              </div>
              <div>
                <span className="label">Acceptance criteria</span>
                <div className="space-y-2">
                  {m.criteria.map((c, ci) => (
                    <div key={ci} className="flex gap-2">
                      <input
                        aria-label={`Milestone ${i + 1} criterion ${ci + 1}`}
                        className="field"
                        value={c}
                        maxLength={LIMITS.criterion}
                        onChange={(e) => updateMilestone(i, { criteria: m.criteria.map((x, xi) => (xi === ci ? e.target.value : x)) })}
                        placeholder="README documents how to run the project"
                      />
                      {m.criteria.length > 1 && (
                        <button type="button" aria-label="Remove criterion" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-white/10 hover:text-rose-300" onClick={() => updateMilestone(i, { criteria: m.criteria.filter((_, xi) => xi !== ci) })}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {m.criteria.length < LIMITS.maxCriteria && (
                  <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-sm text-cyanx-300 hover:underline" onClick={() => updateMilestone(i, { criteria: [...m.criteria, ''] })}>
                    <Plus className="h-4 w-4" aria-hidden /> Add criterion
                  </button>
                )}
              </div>
            </Card>
          ))}

          {milestones.length < LIMITS.maxMilestones && (
            <button type="button" className="btn-ghost w-full" onClick={() => setMilestones((ms) => [...ms, emptyMilestone()])}>
              <Plus className="h-4 w-4" aria-hidden /> Add milestone
            </button>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-white">Before you sign</h2>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-2.5"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-cyanx-400" aria-hidden />Criteria become immutable once the freelancer accepts.</li>
              <li className="flex gap-2.5"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-cyanx-400" aria-hidden />Write criteria that can be checked from public evidence, such as a repository or commit.</li>
              <li className="flex gap-2.5"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-cyanx-400" aria-hidden />This MVP records decisions only. No funds are held or moved.</li>
            </ul>
          </Card>
          {formError && <ErrorNote message={formError} />}
          {lastTx?.phase === 'failed' && lastTx.error && <ErrorNote message={lastTx.error} />}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
            {busy ? 'Waiting for network...' : 'Create agreement'}
          </button>
        </aside>
      </form>
    </>
  )
}
