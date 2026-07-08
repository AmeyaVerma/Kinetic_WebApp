import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { fetchCurrentUser } from '../../lib/api'
import type { CurrentUser } from '../../lib/types'

export function Layout() {
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    fetchCurrentUser().then(setUser)
  }, [])

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {user && <Topbar user={user} notifications={3} />}
        <main className="mx-auto w-full max-w-content flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
