import { createContext, useContext, useState } from 'react'
import { spendRecords as seedSpendRecords } from '../lib/mockData'

const SpendContext = createContext(null)

export function SpendProvider({ children }) {
  const [spendRecords, setSpendRecords] = useState(() => seedSpendRecords.map((r) => ({ ...r })))

  function addSpendRecord(data) {
    const newRecord = {
      ...data,
      id: `spend_${Date.now()}`,
      orgId: 'org_demo',
      createdAt: new Date(),
    }
    setSpendRecords((prev) => [...prev, newRecord])
  }

  function updateSpendRecord(id, data) {
    setSpendRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...data } : r))
    )
  }

  return (
    <SpendContext.Provider value={{ spendRecords, addSpendRecord, updateSpendRecord }}>
      {children}
    </SpendContext.Provider>
  )
}

export function useSpendContext() {
  const ctx = useContext(SpendContext)
  if (!ctx) throw new Error('useSpendContext must be used inside SpendProvider')
  return ctx
}
