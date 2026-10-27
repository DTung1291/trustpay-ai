import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  clearContractAddress,
  getConfiguredContractAddress,
  isContractAddressFromEnv,
  saveContractAddress,
} from '@/lib/genlayer'
import { isAddress } from '@/lib/validation'

interface ContractValue {
  address?: string
  fromEnv: boolean
  setAddress: (value: string) => string | null
  clear: () => void
}

const ContractContext = createContext<ContractValue | null>(null)

export function ContractProvider({ children }: { children: ReactNode }) {
  const [address, setAddr] = useState<string | undefined>(() => getConfiguredContractAddress())

  const setAddress = useCallback((value: string) => {
    if (!isAddress(value)) return 'Enter a valid 0x contract address (42 characters).'
    saveContractAddress(value)
    setAddr(value.trim())
    return null
  }, [])

  const clear = useCallback(() => {
    clearContractAddress()
    setAddr(getConfiguredContractAddress())
  }, [])

  const value = useMemo(
    () => ({ address, fromEnv: isContractAddressFromEnv(), setAddress, clear }),
    [address, setAddress, clear],
  )
  return <ContractContext.Provider value={value}>{children}</ContractContext.Provider>
}

export function useContract(): ContractValue {
  const ctx = useContext(ContractContext)
  if (!ctx) throw new Error('useContract must be used inside ContractProvider')
  return ctx
}
