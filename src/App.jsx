import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'
import { MockAuthProvider } from './lib/mockAuth'
import { SupplierProvider } from './context/SupplierContext'
import { ContractProvider } from './context/ContractContext'
import { SpendProvider } from './context/SpendContext'
import { ChatProvider } from './context/ChatContext'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Contracts from './pages/Contracts'
import Risk from './pages/Risk'
import ESG from './pages/ESG'
import Spend from './pages/Spend'
import AIAssistant from './pages/AIAssistant'
import PlaceholderPage from './pages/PlaceholderPage'

const PLACEHOLDER_ROUTES = [
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
              <ChatProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route element={<AppShell />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/suppliers" element={<Suppliers />} />
                      <Route path="/suppliers/:id" element={<SupplierDetail />} />
                      <Route path="/contracts" element={<Contracts />} />
                      <Route path="/risk" element={<Risk />} />
                      <Route path="/esg" element={<ESG />} />
                      <Route path="/spend" element={<Spend />} />
                      <Route path="/ai-assistant" element={<AIAssistant />} />
                      {PLACEHOLDER_ROUTES.map(({ path, title, phase }) => (
                        <Route key={path} path={path} element={<PlaceholderPage title={title} phase={phase} />} />
                      ))}
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </ChatProvider>
            </SpendProvider>
          </ContractProvider>
        </SupplierProvider>
      </MockAuthProvider>
    </ErrorBoundary>
  )
}
