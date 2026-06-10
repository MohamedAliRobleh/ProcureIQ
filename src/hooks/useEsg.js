import { useEffect, useState } from 'react'
import { esgResponses } from '../lib/mockData'

export function useEsg() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      try {
        setData(esgResponses)
      } catch (e) {
        setError(e)
      } finally {
        setIsLoading(false)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { esgResponses: data, isLoading, error }
}
