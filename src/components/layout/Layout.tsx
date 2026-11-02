import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from './nav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useCurrentUser } from '../../store/useAuthStore'

export function Layout() {
  const user = useCurrentUser()
  const { pathname } = useLocation()

  // Browser tab title: the section the person is in, so several open tabs of
  // the ERP can be told apart. Longest matching nav path wins.
  useEffect(() => {
    const hit = NAV_ITEMS.filter((n) => pathname === n.path || pathname.startsWith(n.path + '/')).sort(
      (a, b) => b.path.length - a.path.length,
    )[0]
    document.title = hit ? `${hit.label} · Kinetic ERP` : 'Kinetic ERP'
  }, [pathname])

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
