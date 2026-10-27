import { createClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'

export const NETWORK = studionet
export const NETWORK_KEY = 'studionet' as const
export const NETWORK_CHAIN_ID = studionet.id
export const NETWORK_CHAIN_ID_HEX = `0x${studionet.id.toString(16)}`
export const EXPLORER_URL = 'https://explorer-studio.genlayer.com'

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

export type GenLayerClientInstance = ReturnType<typeof createClient>

let readClient: GenLayerClientInstance | undefined

/** Account-free client for contract reads. */
export function getReadClient(): GenLayerClientInstance {
  readClient ??= createClient({ chain: NETWORK })
  return readClient
}

/** Provider-backed client. Writes are signed by the user's wallet. */
export function getWriteClient(address: string): GenLayerClientInstance {
  if (!window.ethereum) throw new Error('No wallet found. Install a GenLayer-compatible wallet such as MetaMask.')
  return createClient({
    chain: NETWORK,
    account: address as `0x${string}`,
    provider: window.ethereum,
  })
}

export interface TxSnapshot {
  statusName?: string
  txExecutionResultName?: string
}

/** Fetch the current consensus status of a transaction. */
export async function fetchTransaction(hash: string): Promise<TxSnapshot> {
  const client = getReadClient() as unknown as {
    getTransaction: (args: { hash: string }) => Promise<TxSnapshot | null>
  }
  const tx = await client.getTransaction({ hash })
  return { statusName: tx?.statusName, txExecutionResultName: tx?.txExecutionResultName }
}

/** Ask the wallet to add and switch to Studionet via the SDK helper. */
export async function switchWalletToNetwork(address: string): Promise<void> {
  const client = getWriteClient(address)
  await client.connect(NETWORK_KEY)
}

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_URL}/transactions/${hash}`
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`
}

// ---- Contract address configuration -------------------------------------

const STORAGE_KEY = 'trustpay-ai:contract-address'
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

export function getConfiguredContractAddress(): string | undefined {
  const fromEnv = (import.meta.env.VITE_TRUSTPAY_CONTRACT_ADDRESS as string | undefined)?.trim()
  if (fromEnv && ADDRESS_RE.test(fromEnv)) return fromEnv
  try {
    const stored = localStorage.getItem(STORAGE_KEY)?.trim()
    if (stored && ADDRESS_RE.test(stored)) return stored
  } catch {
    // storage unavailable
  }
  return undefined
}

export function isContractAddressFromEnv(): boolean {
  const fromEnv = (import.meta.env.VITE_TRUSTPAY_CONTRACT_ADDRESS as string | undefined)?.trim()
  return !!fromEnv && ADDRESS_RE.test(fromEnv)
}

export function saveContractAddress(address: string): void {
  localStorage.setItem(STORAGE_KEY, address.trim())
}

export function clearContractAddress(): void {
  localStorage.removeItem(STORAGE_KEY)
}
