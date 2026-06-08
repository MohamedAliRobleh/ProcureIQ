import { useEffect, useState } from 'react'
import { contracts } from '../lib/mockData'

export function useContracts() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const timer = setTimeout(() => {
      setData(contracts)
      setIsLoading(false)
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { contracts: data, isLoading }
}
