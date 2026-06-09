import { useEffect, useState } from 'react'
import { suppliers } from '../lib/mockData'

export function useSuppliers() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      try {
        setData(suppliers)
      } catch (e) {
        setError(e)
      } finally {
        setIsLoading(false)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { suppliers: data, isLoading, error }
}
