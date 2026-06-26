import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'
import ProtectedRoute from './components/layout/ProtectedRoute'
import RequireOrg from './components/layout/RequireOrg'
import OrgScopedProviders from './components/layout/OrgScopedProviders'
import { AuthProvider } from './lib/auth'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Contracts from './pages/Contracts'
import Risk from './pages/Risk'
import ESG from './pages/ESG'
import Spend from './pages/Spend'
import AIAssistant from './pages/AIAssistant'
import Admin from './pages/Admin'
import Portal from './pages/Portal'
import Billing from './pages/Billing'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <RequireOrg>
                    <OrgScopedProviders>
                      <AppShell />
                    </OrgScopedProviders>
                  </RequireOrg>
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/suppliers/:id" element={<SupplierDetail />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/risk" element={<Risk />} />
              <Route path="/esg" element={<ESG />} />
              <Route path="/spend" element={<Spend />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="/portal" element={<Portal />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
