import { createContext, useContext, useState } from 'react'
import { contracts as seedContracts } from '../lib/mockData'

const ContractContext = createContext(null)

export function ContractProvider({ children }) {
  const [contracts, setContracts] = useState(() => seedContracts.map((c) => ({ ...c })))

  function addContract(data) {
    const newContract = {
      ...data,
      id: `con_${Date.now()}`,
      orgId: 'org_demo',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setContracts((prev) => [...prev, newContract])
  }

  function updateContract(id, data) {
    setContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data, updatedAt: new Date() } : c))
    )
  }

  function setContractStatus(id, status) {
    setContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status, updatedAt: new Date() } : c))
    )
  }

  return (
    <ContractContext.Provider value={{ contracts, addContract, updateContract, setContractStatus }}>
      {children}
    </ContractContext.Provider>
  )
}

export function useContractContext() {
  const ctx = useContext(ContractContext)
  if (!ctx) throw new Error('useContractContext must be used inside ContractProvider')
  return ctx
}
