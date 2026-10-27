import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Lock } from 'lucide-react'
import { useContract } from '@/hooks/useContract'
import { useWallet } from '@/hooks/useWallet'
import { useAsync } from '@/hooks/useAsync'
import { useTransactions } from '@/hooks/useTransactions'
import { getAgreementBundle, sendAcceptAgreement } from '@/lib/contract'
import { formatTimestamp } from '@/lib/stats'
import { sameAddress, shortAddress } from '@/lib/validation'
import { AgreementBadge, Card, ErrorNote, Spinner } from '@/components/ui'
import { MilestoneCard } from '@/components/MilestoneCard'

export function AgreementDetail() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const validId = Number.isInteger(id) && id >= 0
  const { address: contract } = useContract()
  const { address: me } = useWallet()
  const { run, isBusy, txs } = useTransactions()

  const { data, error, loading, reload } = useAsync(
    validId && contract ? `${contract}:${id}` : null,
    () => getAgreementBundle(contract!, id),
  )

  // While a verification is running, keep refreshing so the result appears without a manual reload.
  const verifying = data?.milestones.some((m) => m.status === 'VERIFYING') ?? false
  useEffect(() => {
    if (!verifying) return
    const t = setInterval(reload, 6000)
    return () => clearInterval(t)
  }, [verifying, reload])

  if (!validId) return <ErrorNote message="That agreement id is not valid." />
  if (error && !data) return <ErrorNote message={error} onRetry={reload} />
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Spinner /> Loading agreement...
      </div>
    )
  }

  const { agreement: a, milestones } = data
  const isClient = sameAddress(a.client, me)
  const isFreelancer = sameAddress(a.freelancer, me)
  const acceptKey = `accept:${a.id}`
  const acceptBusy = isBusy(acceptKey)
  const acceptTx = txs.find((t) => t.key === acceptKey)

  const accept = () =>
    void run({
      key: acceptKey,
      label: `Accept agreement #${a.id}`,
      send: () => sendAcceptAgreement(contract!, me!, a.id),
      onProgress: reload,
    })

  return (
    <>
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
      </Link>

      <div className="mb-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500">Agreement #{a.id}</span>
            <AgreementBadge status={a.status} />
            {isClient && <span className="text-xs text-cyanx-300">You are the client</span>}
            {isFreelancer && <span className="text-xs text-cyanx-300">You are the freelancer</span>}
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">{a.title}</h1>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{a.description}</p>
        </Card>

        <Card className="space-y-3 text-sm">
          <div>
            <p className="label">Client</p>
            <p className="font-mono text-slate-200" title={a.client}>{shortAddress(a.client)}</p>
          </div>
          <div>
            <p className="label">Freelancer</p>
            <p className="font-mono text-slate-200" title={a.freelancer}>{shortAddress(a.freelancer)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="label">Created</p>
              <p className="text-slate-300">{formatTimestamp(a.createdAt)}</p>
            </div>
            <div>
              <p className="label">Accepted</p>
              <p className="text-slate-300">{formatTimestamp(a.acceptedAt)}</p>
            </div>
          </div>
          {a.status === 'PENDING_ACCEPTANCE' && isFreelancer && (
            <>
              <p className="flex gap-2 rounded-xl bg-amber-400/10 p-3 text-xs text-amber-200">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Review every criterion below. Once you accept, they cannot be changed.
              </p>
              <button type="button" className="btn-primary w-full" onClick={accept} disabled={acceptBusy}>
                {acceptBusy ? <Spinner /> : <Check className="h-4 w-4" aria-hidden />}
                Accept agreement
              </button>
              {acceptTx?.phase === 'failed' && acceptTx.error && <ErrorNote message={acceptTx.error} />}
            </>
          )}
          {a.status === 'PENDING_ACCEPTANCE' && !isFreelancer && (
            <p className="rounded-xl bg-white/5 p-3 text-xs text-slate-400">
              Waiting for the freelancer to accept. Only the named freelancer can accept.
            </p>
          )}
          {a.status !== 'PENDING_ACCEPTANCE' && (
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5" aria-hidden /> Criteria are locked.
            </p>
          )}
        </Card>
      </div>

      {error && (
        <div className="mb-5">
          <ErrorNote message={error} onRetry={reload} />
        </div>
      )}

      <div className="space-y-5">
        {milestones.map((m) => (
          <MilestoneCard
            key={m.index}
            contract={contract!}
            me={me!}
            agreement={a}
            milestone={m}
            isClient={isClient}
            isFreelancer={isFreelancer}
            onChanged={reload}
          />
        ))}
      </div>
      {loading && <p className="mt-4 text-xs text-slate-500">Refreshing from the contract...</p>}
    </>
  )
}
