import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { NETWORK_CHAIN_ID, switchWalletToNetwork } from '@/lib/genlayer'
import { describeWalletError } from '@/lib/tx'

export type WalletStatus = 'no-wallet' | 'disconnected' | 'connecting' | 'connected'

interface WalletValue {
  status: WalletStatus
  address?: string
  chainId?: number
  isCorrectNetwork: boolean
  error?: string
  connect: () => Promise<void>
  disconnect: () => void
  switchNetwork: () => Promise<void>
}

const WalletContext = createContext<WalletValue | null>(null)

const parseChainId = (v: unknown): number | undefined => {
  if (typeof v === 'string') return Number.parseInt(v, v.startsWith('0x') ? 16 : 10)
  if (typeof v === 'number') return v
  return undefined
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>(window.ethereum ? 'disconnected' : 'no-wallet')
  const [address, setAddress] = useState<string>()
  const [chainId, setChainId] = useState<number>()
  const [error, setError] = useState<string>()
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false)

  const applyAccounts = useCallback((accounts: unknown) => {
    const first = Array.isArray(accounts) ? (accounts[0] as string | undefined) : undefined
    setAddress(first)
    setStatus(first ? 'connected' : 'disconnected')
  }, [])

  // Restore an already-authorized session without prompting.
  useEffect(() => {
    const eth = window.ethereum
    if (!eth) return
    let cancelled = false
    void (async () => {
      try {
        const [accounts, chain] = await Promise.all([
          eth.request({ method: 'eth_accounts' }),
          eth.request({ method: 'eth_chainId' }),
        ])
        if (cancelled) return
        setChainId(parseChainId(chain))
        if (!manuallyDisconnected) applyAccounts(accounts)
      } catch {
        // wallet not ready; user can connect manually
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyAccounts, manuallyDisconnected])

  useEffect(() => {
    const eth = window.ethereum
    if (!eth?.on) return
    const onAccounts = (accounts: unknown) => {
      if (!manuallyDisconnected) applyAccounts(accounts)
    }
    const onChain = (id: unknown) => setChainId(parseChainId(id))
    eth.on('accountsChanged', onAccounts)
    eth.on('chainChanged', onChain)
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts)
      eth.removeListener?.('chainChanged', onChain)
    }
  }, [applyAccounts, manuallyDisconnected])

  const connect = useCallback(async () => {
    const eth = window.ethereum
    if (!eth) {
      setStatus('no-wallet')
      setError('No browser wallet detected.')
      return
    }
    setError(undefined)
    setStatus('connecting')
    setManuallyDisconnected(false)
    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' })
      const chain = await eth.request({ method: 'eth_chainId' })
      setChainId(parseChainId(chain))
      applyAccounts(accounts)
    } catch (err) {
      setStatus('disconnected')
      setError(describeWalletError(err))
    }
  }, [applyAccounts])

  const disconnect = useCallback(() => {
    setManuallyDisconnected(true)
    setAddress(undefined)
    setStatus('disconnected')
  }, [])

  const switchNetwork = useCallback(async () => {
    if (!address) return
    setError(undefined)
    try {
      await switchWalletToNetwork(address)
      const chain = await window.ethereum?.request({ method: 'eth_chainId' })
      setChainId(parseChainId(chain))
    } catch (err) {
      setError(describeWalletError(err))
    }
  }, [address])

  const value = useMemo<WalletValue>(
    () => ({
      status,
      address,
      chainId,
      isCorrectNetwork: chainId === NETWORK_CHAIN_ID,
      error,
      connect,
      disconnect,
      switchNetwork,
    }),
    [status, address, chainId, error, connect, disconnect, switchNetwork],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}
