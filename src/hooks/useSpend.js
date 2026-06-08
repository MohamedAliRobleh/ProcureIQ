import { useEffect, useState } from 'react'
import { spendRecords } from '../lib/mockData'

export function useSpend() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const timer = setTimeout(() => {
      setData(spendRecords)
      setIsLoading(false)
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { spendRecords: data, isLoading }
}
