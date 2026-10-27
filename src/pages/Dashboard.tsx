import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, FilePlus2, FileText, Hourglass, RefreshCw, XCircle } from 'lucide-react'
import { useContract } from '@/hooks/useContract'
import { useWallet } from '@/hooks/useWallet'
import { useAsync } from '@/hooks/useAsync'
import { getBundlesFor } from '@/lib/contract'
import { buildActivity, computeStats, formatTimestamp } from '@/lib/stats'
import { explorerAddressUrl } from '@/lib/genlayer'
import { sameAddress, shortAddress } from '@/lib/validation'
import { AgreementBadge, Card, Empty, ErrorNote, SectionTitle, StatCard } from '@/components/ui'

export function Dashboard() {
  const { address: contract, clear, fromEnv } = useContract()
  const { address: me } = useWallet()
  const { data, error, loading, reload } = useAsync(
    contract && me ? `${contract}:${me}` : null,
    () => getBundlesFor(contract!, me!),
  )
  const bundles = data ?? []
  const stats = computeStats(bundles)
  const activity = buildActivity(bundles)
  const initialLoad = loading && !data

  return (
    <>
      <SectionTitle eyebrow="Dashboard" title="Milestone verification">
        <div className="flex gap-2">
          <button type="button" onClick={reload} className="btn-ghost" disabled={loading} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
          <Link to="/create" className="btn-primary">
            <FilePlus2 className="h-4 w-4" aria-hidden />
            New agreement
          </Link>
        </div>
      </SectionTitle>

      {error && (
        <div className="mb-5">
          <ErrorNote message={error} onRetry={reload} />
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Agreements" value={stats.totalAgreements} loading={initialLoad} icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Pending verification" value={stats.pendingVerification} loading={initialLoad} icon={<Hourglass className="h-4 w-4" />} />
        <StatCard label="Approved" value={stats.approvedMilestones} loading={initialLoad} icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
        <StatCard label="Rejected" value={stats.rejectedMilestones} loading={initialLoad} icon={<XCircle className="h-4 w-4 text-rose-400" />} />
      </div>
      <p className="-mt-3 mb-6 text-xs text-slate-500">
        Counts cover agreements where your wallet is the client or the freelancer, read from the contract.
      </p>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">Your agreements</h2>
          {initialLoad ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : bundles.length === 0 ? (
            <Empty title="No agreements yet">
              Create one as a client, or ask a client to name your wallet as the freelancer.
            </Empty>
          ) : (
            <ul className="space-y-2.5">
              {bundles.map(({ agreement: a, milestones }, i) => {
                const approved = milestones.filter((m) => m.status === 'APPROVED').length
                return (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to={`/agreements/${a.id}`}
                      className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-cyanx-400/40 hover:bg-white/[0.05]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">#{a.id}</span>
                          <AgreementBadge status={a.status} />
                          <span className="text-xs text-slate-500">
                            {sameAddress(a.client, me) ? 'You are the client' : 'You are the freelancer'}
                          </span>
                        </div>
                        <p className="truncate font-medium text-white">{a.title}</p>
                        <p className="text-xs tabular-nums text-slate-400">
                          {approved}/{a.milestoneCount} milestones approved
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyanx-300" aria-hidden />
                    </Link>
                  </motion.li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-white">Recent activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing recorded onchain for your wallet yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((item, i) => (
                  <li key={`${item.agreementId}-${item.kind}-${item.at}-${i}`} className="text-sm">
                    <Link to={`/agreements/${item.agreementId}`} className="font-medium text-slate-200 hover:text-cyanx-300">
                      {item.detail}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      #{item.agreementId} {item.agreementTitle} - {formatTimestamp(item.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-semibold text-white">Contract</h2>
            <a
              href={explorerAddressUrl(contract!)}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-xs text-cyanx-300 hover:underline"
              title={contract}
            >
              {shortAddress(contract)}
            </a>
            {!fromEnv && (
              <button type="button" onClick={clear} className="mt-3 block text-xs text-slate-400 underline underline-offset-2 hover:text-white">
                Use a different contract
              </button>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
