import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'
import { MockAuthProvider } from './lib/mockAuth'
import Dashboard from './pages/Dashboard'
import PlaceholderPage from './pages/PlaceholderPage'

const PLACEHOLDER_ROUTES = [
  { path: '/suppliers', title: 'Suppliers', phase: 'Phase 2' },
  { path: '/contracts', title: 'Contracts', phase: 'Phase 3' },
  { path: '/risk', title: 'Risk', phase: 'Phase 3' },
  { path: '/esg', title: 'ESG', phase: 'Phase 4' },
  { path: '/spend', title: 'Spend', phase: 'Phase 4' },
  { path: '/ai-assistant', title: 'AI Assistant', phase: 'Phase 5' },
  { path: '/portal', title: 'Supplier Portal', phase: 'Phase 7' },
  { path: '/admin', title: 'Admin', phase: 'Phase 7' },
]

export default function App() {
  return (
    <ErrorBoundary>
      <MockAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              {PLACEHOLDER_ROUTES.map(({ path, title, phase }) => (
                <Route key={path} path={path} element={<PlaceholderPage title={title} phase={phase} />} />
              ))}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MockAuthProvider>
    </ErrorBoundary>
  )
}
