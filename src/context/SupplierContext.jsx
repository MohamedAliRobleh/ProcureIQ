import { createContext, useContext, useState } from 'react'
import { suppliers as seedSuppliers } from '../lib/mockData'

const SupplierContext = createContext(null)

export function SupplierProvider({ children }) {
  const [suppliers, setSuppliers] = useState(() => seedSuppliers.map((s) => ({ ...s })))

  function addSupplier(data) {
    const newSupplier = {
      ...data,
      id: `sup_${Date.now()}`,
      orgId: 'org_demo',
      riskScore: 0,
      esgScore: 0,
      logoUrl: null,
      onboardedAt: new Date(),
      createdAt: new Date(),
    }
    setSuppliers((prev) => [...prev, newSupplier])
  }

  function updateSupplier(id, data) {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)))
  }

  function setSupplierStatus(id, status) {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
  }

  return (
    <SupplierContext.Provider value={{ suppliers, addSupplier, updateSupplier, setSupplierStatus }}>
      {children}
    </SupplierContext.Provider>
  )
}

export function useSupplierContext() {
  const ctx = useContext(SupplierContext)
  if (!ctx) throw new Error('useSupplierContext must be used inside SupplierProvider')
  return ctx
}
