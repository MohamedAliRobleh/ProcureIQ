import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { TourProvider } from '../tour/TourProvider'
import Tour from '../tour/Tour'

export default function AppShell() {
  return (
    <TourProvider>
      <div className="min-h-screen bg-bg-primary">
        <Sidebar />
        <div className="lg:pl-64">
          <TopBar />
          <main className="px-6 py-8">
            <Outlet />
          </main>
        </div>
        <Tour />
      </div>
    </TourProvider>
  )
}
