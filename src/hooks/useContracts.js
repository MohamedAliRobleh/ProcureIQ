import { useContractContext } from '../context/ContractContext'

export function useContracts() {
  const { contracts, isLoading, error } = useContractContext()
  return { contracts: isLoading ? null : contracts, isLoading, error }
}
