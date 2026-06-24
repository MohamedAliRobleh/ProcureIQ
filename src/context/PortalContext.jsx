import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

const PortalContext = createContext(null)

export function PortalProvider({ children }) {
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/portal-requests')
      .then((data) => {
        if (!cancelled) setRequests(data)
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

  function createRequest(data) {
    return api
      .post('/api/portal-requests', data)
      .then((created) => {
        setRequests((prev) => [created, ...prev])
        return created
      })
      .catch((e) => {
        setError(e)
        throw e
      })
  }

  function updateRequest(id, patch) {
    return api
      .patch(`/api/portal-requests/${id}`, patch)
      .then((updated) => {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)))
        return updated
      })
      .catch((e) => {
        setError(e)
        throw e
      })
  }

  function deleteRequest(id) {
    return api
      .del(`/api/portal-requests/${id}`)
      .then(() => setRequests((prev) => prev.filter((r) => r.id !== id)))
      .catch((e) => {
        setError(e)
        throw e
      })
  }

  function notifyRequest(id) {
    return api.post('/api/portal-requests/notify', { id }).catch((e) => {
      setError(e)
      throw e
    })
  }

  return (
    <PortalContext.Provider
      value={{ requests, isLoading, error, createRequest, updateRequest, deleteRequest, notifyRequest }}
    >
      {children}
    </PortalContext.Provider>
  )
}

export function usePortalContext() {
  const ctx = useContext(PortalContext)
  if (!ctx) throw new Error('usePortalContext must be used inside PortalProvider')
  return ctx
}
