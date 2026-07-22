import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Layout } from './components/layout/Layout'
import { DesignSystemPage } from './pages/DesignSystemPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { NvoccPage } from './pages/NvoccPage'
import { BookingDetailPage } from './pages/BookingDetailPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { MnrPage } from './pages/MnrPage'
import { FreightPage } from './pages/FreightPage'
import { FfDetailPage } from './pages/FfDetailPage'
import { CustomersPage } from './pages/CustomersPage'
import { AgentsPage } from './pages/AgentsPage'
import { HrPage } from './pages/HrPage'
import { LoginPage } from './pages/LoginPage'
import { ExternalPortal } from './pages/ExternalPortal'
import { UsersRolesPage } from './pages/admin/UsersRolesPage'
import { useAuthStore, useCurrentUser } from './store/useAuthStore'
import { effectiveAccess, isExternal, LANDING, type ModuleKey } from './lib/rbac'

/** Gate a route by module access — redirect to the user's landing if denied. */
function Guard({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  const role = viewAsRole ?? user.role
  const overrides = viewAsRole ? undefined : user.overrides
  if (effectiveAccess(role, overrides, module) === 'none') {
    return <Navigate to={LANDING[role]} replace />
  }
  return <>{children}</>
}

export default function App() {
  const user = useCurrentUser()

  // Not signed in → login screen only
  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    )
  }

  // External roles → scoped portal, no internal shell
  if (isExternal(user.role)) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<ExternalPortal user={user} />} />
        </Routes>
      </BrowserRouter>
    )
  }

  // Internal staff → the ERP shell with per-route guards
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to={LANDING[user.role]} replace />} />
          <Route path="/login" element={<Navigate to={LANDING[user.role]} replace />} />
          <Route path="/nvocc" element={<Guard module="nvocc"><NvoccPage /></Guard>} />
          <Route path="/nvocc/:id" element={<Guard module="nvocc"><BookingDetailPage /></Guard>} />
          <Route path="/freight" element={<Guard module="freight"><FreightPage /></Guard>} />
          <Route path="/freight/:id" element={<Guard module="freight"><FfDetailPage /></Guard>} />
          <Route path="/mnr" element={<Guard module="mnr"><MnrPage /></Guard>} />
          <Route path="/accounts" element={<Guard module="accounts"><PlaceholderPage title="Accounts" /></Guard>} />
          <Route path="/master" element={<Guard module="master"><PlaceholderPage title="Master Data" /></Guard>} />
          <Route path="/approvals" element={<Guard module="approvals"><ApprovalsPage /></Guard>} />
          <Route path="/portal/customer" element={<Guard module="customers"><CustomersPage /></Guard>} />
          <Route path="/portal/agent" element={<Guard module="agents"><AgentsPage /></Guard>} />
          <Route path="/reports" element={<Guard module="reports"><PlaceholderPage title="Reports" /></Guard>} />
          <Route path="/hr" element={<Guard module="hr"><HrPage /></Guard>} />
          <Route path="/settings" element={<Guard module="settings"><PlaceholderPage title="Settings" /></Guard>} />
          <Route path="/admin/users" element={<Guard module="users"><UsersRolesPage /></Guard>} />
          <Route path="/design-system" element={<DesignSystemPage />} />
          <Route path="*" element={<Navigate to={LANDING[user.role]} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
