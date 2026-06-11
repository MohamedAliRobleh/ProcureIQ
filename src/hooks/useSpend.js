import { useSpendContext } from '../context/SpendContext'

export function useSpend() {
  const { spendRecords, isLoading, error } = useSpendContext()
  return { spendRecords: isLoading ? null : spendRecords, isLoading, error }
}
