import { useEffect, useState } from 'react'
import { spendRecords } from '../lib/mockData'

export function useSpend() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      try {
        setData(spendRecords)
      } catch (e) {
        setError(e)
      } finally {
        setIsLoading(false)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { spendRecords: data, isLoading, error }
}
