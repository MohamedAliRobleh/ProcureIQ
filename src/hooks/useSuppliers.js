import { useSupplierContext } from '../context/SupplierContext'

export function useSuppliers() {
  const { suppliers, isLoading, error } = useSupplierContext()
  return { suppliers: isLoading ? null : suppliers, isLoading, error }
}
