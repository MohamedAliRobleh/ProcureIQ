import { Fragment } from 'react'
import { useOrganization } from '../../lib/auth'
import { SupplierProvider } from '../../context/SupplierContext'
import { ContractProvider } from '../../context/ContractContext'
import { SpendProvider } from '../../context/SpendContext'
import { ChatProvider } from '../../context/ChatContext'

// Remounts the entire data-provider stack when the active org changes, so each
// context refetches for the new org. apiClient's per-request getToken() already
// returns a token carrying the newly-active org. Rendered inside RequireOrg, so
// `organization` is always present here.
export default function OrgScopedProviders({ children }) {
  const { organization } = useOrganization()
  return (
    <Fragment key={organization?.id}>
      <SupplierProvider>
        <ContractProvider>
          <SpendProvider>
            <ChatProvider>{children}</ChatProvider>
          </SpendProvider>
        </ContractProvider>
      </SupplierProvider>
    </Fragment>
  )
}
