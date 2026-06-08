import { useEffect, useState } from 'react'
import { riskAssessments } from '../lib/mockData'

export function useRisk() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const timer = setTimeout(() => {
      setData(riskAssessments)
      setIsLoading(false)
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  return { riskAssessments: data, isLoading }
}
