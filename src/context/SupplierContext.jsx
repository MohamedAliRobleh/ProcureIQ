import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

const SupplierContext = createContext(null)

export function SupplierProvider({ children }) {
  const [suppliers, setSuppliers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/suppliers')
      .then((data) => {
        if (!cancelled) setSuppliers(data)
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

  function addSupplier(data) {
    api
      .post('/api/suppliers', data)
      .then((created) => setSuppliers((prev) => [...prev, created]))
      .catch((e) => setError(e))
  }

  function updateSupplier(id, data) {
    api
      .patch(`/api/suppliers/${id}`, data)
      .then((updated) => setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s))))
      .catch((e) => setError(e))
  }

  function setSupplierStatus(id, status) {
    updateSupplier(id, { status })
  }

  return (
    <SupplierContext.Provider
      value={{ suppliers, isLoading, error, addSupplier, updateSupplier, setSupplierStatus }}
    >
      {children}
    </SupplierContext.Provider>
  )
}

export function useSupplierContext() {
  const ctx = useContext(SupplierContext)
  if (!ctx) throw new Error('useSupplierContext must be used inside SupplierProvider')
  return ctx
}
