import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

const SpendContext = createContext(null)

export function SpendProvider({ children }) {
  const [spendRecords, setSpendRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/spend')
      .then((data) => {
        if (!cancelled) setSpendRecords(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function addSpendRecord(data) {
    api
      .post('/api/spend', data)
      .then((created) => setSpendRecords((prev) => [...prev, created]))
      .catch((e) => setError(e))
  }

  function updateSpendRecord(id, data) {
    api
      .patch(`/api/spend/${id}`, data)
      .then((updated) => setSpendRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r))))
      .catch((e) => setError(e))
  }

  return (
    <SpendContext.Provider value={{ spendRecords, isLoading, error, addSpendRecord, updateSpendRecord }}>
      {children}
    </SpendContext.Provider>
  )
}

export function useSpendContext() {
  const ctx = useContext(SpendContext)
  if (!ctx) throw new Error('useSpendContext must be used inside SpendProvider')
  return ctx
}
