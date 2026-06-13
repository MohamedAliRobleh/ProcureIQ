import { Navigate } from 'react-router-dom'
import LoadingSpinner from '../ui/LoadingSpinner'
import { useUser } from '../../lib/auth'

export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useUser()
  if (!isLoaded) return <LoadingSpinner className="min-h-screen" />
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return children
}
