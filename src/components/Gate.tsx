import { useState, type ReactNode } from 'react'
import { AlertTriangle, FileCode2, Plug } from 'lucide-react'
import { useContract } from '@/hooks/useContract'
import { useWallet } from '@/hooks/useWallet'
import { NETWORK } from '@/lib/genlayer'
import { probeContract } from '@/lib/contract'
import { isAddress } from '@/lib/validation'
import { Card, ErrorNote, Spinner } from './ui'

function ContractSetup() {
  const { setAddress } = useContract()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const submit = async () => {
    const format = isAddress(value) ? null : 'Enter a valid 0x contract address (42 characters).'
    if (format) {
      setError(format)
      return
    }
    setError(null)
    setChecking(true)
    try {
      await probeContract(value.trim())
      setError(setAddress(value))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the contract.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-violetx-500/15 text-violetx-400">
          <FileCode2 className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-white">Connect the verification contract</h2>
          <p className="text-sm text-slate-400">No TrustPay AI contract address is configured yet.</p>
        </div>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-slate-300">
        This app reads and writes a real GenLayer Intelligent Contract on {NETWORK.name}. Deploy the contract
        in an external GenLayer environment (see <span className="font-mono text-cyanx-300">deploy/README.md</span>),
        then paste its address here or set <span className="font-mono text-cyanx-300">VITE_TRUSTPAY_CONTRACT_ADDRESS</span>.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-3"
      >
        <div>
          <label htmlFor="contract-address" className="label">
            Contract address
          </label>
          <input
            id="contract-address"
            className="field font-mono"
            placeholder="0x..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {error && <ErrorNote message={error} />}
        <button type="submit" className="btn-primary w-full" disabled={checking}>
          {checking && <Spinner />}
          {checking ? 'Checking the contract...' : 'Use this contract'}
        </button>
      </form>
    </Card>
  )
}

/** Renders children only when a contract is configured, a wallet is connected, and the network is right. */
export function Gate({ children }: { children: ReactNode }) {
  const { address: contract } = useContract()
  const w = useWallet()

  if (!contract) return <ContractSetup />

  if (w.status === 'no-wallet') {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <h2 className="text-xl font-semibold text-white">No wallet detected</h2>
        <p className="mt-2 text-sm text-slate-400">
          Install a GenLayer-compatible browser wallet (MetaMask works with the Studionet network) and reload.
        </p>
      </Card>
    )
  }

  if (w.status !== 'connected') {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <h2 className="text-xl font-semibold text-white">Connect your wallet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
          Your address decides which agreements you see and which actions you can take.
        </p>
        {w.error && (
          <div className="mt-4 text-left">
            <ErrorNote message={w.error} />
          </div>
        )}
        <button type="button" className="btn-primary mt-5" onClick={() => void w.connect()} disabled={w.status === 'connecting'}>
          {w.status === 'connecting' ? <Spinner /> : <Plug className="h-4 w-4" aria-hidden />}
          Connect wallet
        </button>
      </Card>
    )
  }

  if (!w.isCorrectNetwork) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-amber-400/10 text-amber-300">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="text-xl font-semibold text-white">Switch to {NETWORK.name}</h2>
        <p className="mt-2 text-sm text-slate-400">
          Your wallet is on chain {w.chainId ?? 'unknown'}. TrustPay AI needs chain {NETWORK.id}.
        </p>
        {w.error && (
          <div className="mt-4 text-left">
            <ErrorNote message={w.error} />
          </div>
        )}
        <button type="button" className="btn-primary mt-5" onClick={() => void w.switchNetwork()}>
          Switch network
        </button>
      </Card>
    )
  }

  return <>{children}</>
}
