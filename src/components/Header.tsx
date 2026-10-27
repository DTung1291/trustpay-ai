import { NavLink, Link } from 'react-router-dom'
import { LogOut, Plug, ShieldCheck, Wallet } from 'lucide-react'
import clsx from 'clsx'
import { useWallet } from '@/hooks/useWallet'
import { shortAddress } from '@/lib/validation'
import { NETWORK } from '@/lib/genlayer'
import { Spinner } from './ui'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/create', label: 'New agreement', end: false },
]

export function Header() {
  const w = useWallet()
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyanx-400 to-violetx-500 text-ink-950">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display text-lg font-semibold tracking-[-0.02em] text-white">
            TrustPay <span className="text-cyanx-400">AI</span>
          </span>
        </Link>

        <nav className="ml-4 hidden gap-1 sm:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {w.status === 'connected' && (
            <span
              className={clsx(
                'hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:inline-flex',
                w.isCorrectNetwork
                  ? 'border-emerald-400/30 text-emerald-300'
                  : 'border-amber-400/40 text-amber-300',
              )}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', w.isCorrectNetwork ? 'bg-emerald-400' : 'bg-amber-400')} />
              {w.isCorrectNetwork ? NETWORK.name : 'Wrong network'}
            </span>
          )}
          {w.status === 'connected' ? (
            <button type="button" onClick={w.disconnect} className="btn-ghost font-mono text-xs" title="Disconnect">
              <Wallet className="h-4 w-4" aria-hidden />
              {shortAddress(w.address)}
              <LogOut className="h-3.5 w-3.5 text-slate-500" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void w.connect()}
              disabled={w.status === 'connecting' || w.status === 'no-wallet'}
              className="btn-primary"
            >
              {w.status === 'connecting' ? <Spinner /> : <Plug className="h-4 w-4" aria-hidden />}
              {w.status === 'no-wallet' ? 'No wallet found' : 'Connect wallet'}
            </button>
          )}
        </div>
      </div>
      <nav className="flex gap-1 border-t border-white/5 px-4 py-1.5 sm:hidden" aria-label="Main">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              clsx(
                'flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium',
                isActive ? 'bg-white/10 text-white' : 'text-slate-400',
              )
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
