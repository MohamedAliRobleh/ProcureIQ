import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <div className="lg:pl-64">
        <TopBar />
        <main className="px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
