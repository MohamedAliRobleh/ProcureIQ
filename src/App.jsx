import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'
import { MockAuthProvider } from './lib/mockAuth'
import { SupplierProvider } from './context/SupplierContext'
import { ContractProvider } from './context/ContractContext'
import { SpendProvider } from './context/SpendContext'
import Dashboard from './pages/Dashboard'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Contracts from './pages/Contracts'
import Risk from './pages/Risk'
import ESG from './pages/ESG'
import Spend from './pages/Spend'
import PlaceholderPage from './pages/PlaceholderPage'

const PLACEHOLDER_ROUTES = [
  { path: '/ai-assistant', title: 'AI Assistant', phase: 'Phase 5' },
  { path: '/portal', title: 'Supplier Portal', phase: 'Phase 7' },
  { path: '/admin', title: 'Admin', phase: 'Phase 7' },
]

export default function App() {
  return (
    <ErrorBoundary>
      <MockAuthProvider>
        <SupplierProvider>
          <ContractProvider>
            <SpendProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/suppliers" element={<Suppliers />} />
                    <Route path="/suppliers/:id" element={<SupplierDetail />} />
                    <Route path="/contracts" element={<Contracts />} />
                    <Route path="/risk" element={<Risk />} />
                    <Route path="/esg" element={<ESG />} />
                    <Route path="/spend" element={<Spend />} />
                    {PLACEHOLDER_ROUTES.map(({ path, title, phase }) => (
                      <Route key={path} path={path} element={<PlaceholderPage title={title} phase={phase} />} />
                    ))}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </SpendProvider>
          </ContractProvider>
        </SupplierProvider>
      </MockAuthProvider>
    </ErrorBoundary>
  )
}
