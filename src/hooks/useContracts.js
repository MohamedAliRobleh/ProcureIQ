import { useState, useEffect } from 'react'
import { useContractContext } from '../context/ContractContext'

export function useContracts() {
  const { contracts } = useContractContext()
  const [data, setData] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setData(contracts), 150)
    return () => clearTimeout(timer)
  }, [contracts])

  return { contracts: data, isLoading: data === null }
}
