import { useEffect, useState } from 'react'
import { suppliers } from '../lib/mockData'

export function useSuppliers() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const timer = setTimeout(() => {
      setData(suppliers)
      setIsLoading(false)
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { suppliers: data, isLoading }
}
