import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'
import ProtectedRoute from './components/layout/ProtectedRoute'
import RequireOrg from './components/layout/RequireOrg'
import OrgScopedProviders from './components/layout/OrgScopedProviders'
import { AuthProvider } from './lib/auth'
import Landing from './pages/Landing'

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const SupplierDetail = lazy(() => import('./pages/SupplierDetail'))
const Contracts = lazy(() => import('./pages/Contracts'))
const Risk = lazy(() => import('./pages/Risk'))
const ESG = lazy(() => import('./pages/ESG'))
const Spend = lazy(() => import('./pages/Spend'))
const AIAssistant = lazy(() => import('./pages/AIAssistant'))
const Admin = lazy(() => import('./pages/Admin'))
const Portal = lazy(() => import('./pages/Portal'))
const Billing = lazy(() => import('./pages/Billing'))
const SignInPage = lazy(() => import('./pages/SignInPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))

// Loading fallback component
const Loading = () => <div className="flex items-center justify-center h-screen">Chargement...</div>

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sign-in/*" element={
              <Suspense fallback={<Loading />}>
                <SignInPage />
              </Suspense>
            } />
            <Route path="/sign-up/*" element={
              <Suspense fallback={<Loading />}>
                <SignUpPage />
              </Suspense>
            } />
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
              <Route path="/dashboard" element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
              <Route path="/suppliers" element={<Suspense fallback={<Loading />}><Suppliers /></Suspense>} />
              <Route path="/suppliers/:id" element={<Suspense fallback={<Loading />}><SupplierDetail /></Suspense>} />
              <Route path="/contracts" element={<Suspense fallback={<Loading />}><Contracts /></Suspense>} />
              <Route path="/risk" element={<Suspense fallback={<Loading />}><Risk /></Suspense>} />
              <Route path="/esg" element={<Suspense fallback={<Loading />}><ESG /></Suspense>} />
              <Route path="/spend" element={<Suspense fallback={<Loading />}><Spend /></Suspense>} />
              <Route path="/ai-assistant" element={<Suspense fallback={<Loading />}><AIAssistant /></Suspense>} />
              <Route path="/admin/*" element={<Suspense fallback={<Loading />}><Admin /></Suspense>} />
              <Route path="/portal" element={<Suspense fallback={<Loading />}><Portal /></Suspense>} />
              <Route path="/billing" element={<Suspense fallback={<Loading />}><Billing /></Suspense>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
