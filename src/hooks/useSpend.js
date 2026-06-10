import { useState, useEffect } from 'react'
import { useSpendContext } from '../context/SpendContext'

export function useSpend() {
  const { spendRecords } = useSpendContext()
  const [data, setData] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setData(spendRecords), 150)
    return () => clearTimeout(timer)
  }, [spendRecords])

  return { spendRecords: data, isLoading: data === null }
}
