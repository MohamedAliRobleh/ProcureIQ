import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

const ContractContext = createContext(null)

export function ContractProvider({ children }) {
  const [contracts, setContracts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/contracts')
      .then((data) => {
        if (!cancelled) setContracts(data)
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

  function addContract(data) {
    api
      .post('/api/contracts', data)
      .then((created) => setContracts((prev) => [...prev, created]))
      .catch((e) => setError(e))
  }

  function updateContract(id, data) {
    api
      .patch(`/api/contracts/${id}`, data)
      .then((updated) => setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c))))
      .catch((e) => setError(e))
  }

  function setContractStatus(id, status) {
    updateContract(id, { status })
  }

  function summarizeContract(id) {
    return api
      .post('/api/contracts/summarize', { id })
      .then((updated) => {
        setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)))
        return updated
      })
      .catch((e) => {
        setError(e)
        throw e
      })
  }

  return (
    <ContractContext.Provider
      value={{ contracts, isLoading, error, addContract, updateContract, setContractStatus, summarizeContract }}
    >
      {children}
    </ContractContext.Provider>
  )
}

export function useContractContext() {
  const ctx = useContext(ContractContext)
  if (!ctx) throw new Error('useContractContext must be used inside ContractProvider')
  return ctx
}
