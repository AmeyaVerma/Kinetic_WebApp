import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useCurrentUser } from '../../store/useAuthStore'

export function Layout() {
  const user = useCurrentUser()

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {user && <Topbar user={user} />}
        <main className="mx-auto w-full max-w-content flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
