import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { Layout } from './components/layout/Layout'
import { DesignSystemPage } from './pages/DesignSystemPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { NvoccPage } from './pages/NvoccPage'
import { BookingDetailPage } from './pages/BookingDetailPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { MnrPage } from './pages/MnrPage'
import { ContainerPositionReportPage } from './pages/mnr/ContainerPositionReportPage'
import { FreightPage } from './pages/FreightPage'
import { FfDetailPage } from './pages/FfDetailPage'
import { CustomersPage } from './pages/CustomersPage'
import { MasterDataPage } from './pages/MasterDataPage'
import { PartiesMasterPage } from './pages/master/PartiesMasterPage'
import { AddPartyPage } from './pages/master/AddPartyPage'
import { PartyDetailPage } from './pages/master/PartyDetailPage'
import { MasterComingSoon } from './pages/master/MasterComingSoon'
import { VesselsMasterPage } from './pages/master/VesselsMasterPage'
import { VesselDetailPage } from './pages/master/VesselDetailPage'
import { AddVesselPage } from './pages/master/AddVesselPage'
import { ContainersHubPage } from './pages/master/ContainersHubPage'
import { ContainersMasterPage } from './pages/master/ContainersMasterPage'
import { ContainerDetailPage } from './pages/master/ContainerDetailPage'
import { EmptyDepotsMasterPage } from './pages/master/EmptyDepotsMasterPage'
import { AddEmptyDepotPage } from './pages/master/AddEmptyDepotPage'
import { EmptyDepotDetailPage } from './pages/master/EmptyDepotDetailPage'
import { PortsHubPage } from './pages/master/PortsHubPage'
import { MiscellaneousHubPage } from './pages/master/MiscellaneousHubPage'
import { PackageTypesMasterPage } from './pages/master/PackageTypesMasterPage'
import { UnitsOfMeasurementMasterPage } from './pages/master/UnitsOfMeasurementMasterPage'
import { CurrenciesMasterPage } from './pages/master/CurrenciesMasterPage'
import { SeaPortsMasterPage } from './pages/master/SeaPortsMasterPage'
import { AddSeaPortPage } from './pages/master/AddSeaPortPage'
import { SeaPortDetailPage } from './pages/master/SeaPortDetailPage'
import { IcdsMasterPage } from './pages/master/IcdsMasterPage'
import { AddIcdPage } from './pages/master/AddIcdPage'
import { IcdDetailPage } from './pages/master/IcdDetailPage'
import { AirPortsMasterPage } from './pages/master/AirPortsMasterPage'
import { AddAirPortPage } from './pages/master/AddAirPortPage'
import { AirPortDetailPage } from './pages/master/AirPortDetailPage'
import { Truck, Wrench, FileWarning, Wallet } from 'lucide-react'
import { AgentsPage } from './pages/AgentsPage'
import { HrPage } from './pages/HrPage'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SettingsPage } from './pages/SettingsPage'
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
  const session = useAuthStore((s) => s.session)
  const profileStatus = useAuthStore((s) => s.profileStatus)
  const authLoading = useAuthStore((s) => s.authLoading)
  const recoveryMode = useAuthStore((s) => s.recoveryMode)
  const initAuth = useAuthStore((s) => s.initAuth)
  const signOut = useAuthStore((s) => s.signOut)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  // Checking for a persisted Supabase session — avoid flashing the login
  // screen before we know whether the user is already signed in.
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    )
  }

  // Arrived via a password-reset email link — set the new password before
  // anything else, regardless of session/profile state.
  if (recoveryMode) {
    return <ResetPasswordPage />
  }

  // Not signed in → login screen only
  if (!session) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    )
  }

  // Signed in, but an Admin hasn't approved + assigned a role yet
  if (profileStatus === 'Pending' || profileStatus === null) {
    return <AccountStatusScreen onSignOut={signOut} kind="pending" />
  }

  // Signed in, but the account has been suspended/rejected
  if (profileStatus === 'Suspended') {
    return <AccountStatusScreen onSignOut={signOut} kind="suspended" />
  }

  if (!user) {
    // Shouldn't happen given the checks above, but keep TypeScript honest
    // and avoid ever rendering the shell without a resolved profile.
    return <AccountStatusScreen onSignOut={signOut} kind="pending" />
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
          <Route
            path="/mnr/container-report"
            element={
              <Guard module="mnr">
                <ContainerPositionReportPage />
              </Guard>
            }
          />
          <Route path="/accounts" element={<Guard module="accounts"><PlaceholderPage title="Accounts" /></Guard>} />
          <Route path="/master" element={<Guard module="master"><MasterDataPage /></Guard>} />
          <Route path="/master/parties" element={<Guard module="master"><PartiesMasterPage /></Guard>} />
          <Route path="/master/parties/new" element={<Guard module="master"><AddPartyPage /></Guard>} />
          <Route path="/master/parties/:code" element={<Guard module="master"><PartyDetailPage /></Guard>} />
          <Route
            path="/master/vendors"
            element={
              <Guard module="master">
                <MasterComingSoon
                  title="Vendors"
                  description="Shipping lines, surveyors, CFS, repair shops, truckers and customs brokers."
                  icon={Truck}
                />
              </Guard>
            }
          />
          <Route path="/master/vessels" element={<Guard module="master"><VesselsMasterPage /></Guard>} />
          <Route path="/master/vessels/new" element={<Guard module="master"><AddVesselPage /></Guard>} />
          <Route path="/master/vessels/:id" element={<Guard module="master"><VesselDetailPage /></Guard>} />
          <Route path="/master/containers" element={<Guard module="master"><ContainersHubPage /></Guard>} />
          <Route path="/master/containers/fleet" element={<Guard module="master"><ContainersMasterPage /></Guard>} />
          <Route path="/master/containers/fleet/:containerNo" element={<Guard module="master"><ContainerDetailPage /></Guard>} />
          <Route path="/master/containers/empty-depots" element={<Guard module="master"><EmptyDepotsMasterPage /></Guard>} />
          <Route path="/master/containers/empty-depots/new" element={<Guard module="master"><AddEmptyDepotPage /></Guard>} />
          <Route path="/master/containers/empty-depots/:id" element={<Guard module="master"><EmptyDepotDetailPage /></Guard>} />
          <Route
            path="/master/containers/cmc"
            element={
              <Guard module="master">
                <MasterComingSoon
                  title="CMC"
                  description="Not built yet."
                  icon={Wrench}
                  backTo="/master/containers"
                  backLabel="Containers"
                />
              </Guard>
            }
          />
          <Route
            path="/master/containers/damage-codes"
            element={
              <Guard module="master">
                <MasterComingSoon
                  title="Container Items / Damage Codes"
                  description="Not built yet."
                  icon={FileWarning}
                  backTo="/master/containers"
                  backLabel="Containers"
                />
              </Guard>
            }
          />
          <Route
            path="/master/accounts"
            element={
              <Guard module="master">
                <MasterComingSoon
                  title="Accounts"
                  description="Chart of accounts / ledger heads used for invoicing and charge posting."
                  icon={Wallet}
                />
              </Guard>
            }
          />
          <Route path="/master/ports" element={<Guard module="master"><PortsHubPage /></Guard>} />
          <Route path="/master/ports/sea-ports" element={<Guard module="master"><SeaPortsMasterPage /></Guard>} />
          <Route path="/master/ports/sea-ports/new" element={<Guard module="master"><AddSeaPortPage /></Guard>} />
          <Route path="/master/ports/sea-ports/:id" element={<Guard module="master"><SeaPortDetailPage /></Guard>} />
          <Route path="/master/ports/icds" element={<Guard module="master"><IcdsMasterPage /></Guard>} />
          <Route path="/master/ports/icds/new" element={<Guard module="master"><AddIcdPage /></Guard>} />
          <Route path="/master/ports/icds/:id" element={<Guard module="master"><IcdDetailPage /></Guard>} />
          <Route path="/master/ports/air-ports" element={<Guard module="master"><AirPortsMasterPage /></Guard>} />
          <Route path="/master/ports/air-ports/new" element={<Guard module="master"><AddAirPortPage /></Guard>} />
          <Route path="/master/ports/air-ports/:id" element={<Guard module="master"><AirPortDetailPage /></Guard>} />
          <Route path="/master/misc" element={<Guard module="master"><MiscellaneousHubPage /></Guard>} />
          <Route path="/master/misc/uom" element={<Guard module="master"><UnitsOfMeasurementMasterPage /></Guard>} />
          <Route path="/master/misc/package-types" element={<Guard module="master"><PackageTypesMasterPage /></Guard>} />
          <Route path="/master/misc/currencies" element={<Guard module="master"><CurrenciesMasterPage /></Guard>} />
          <Route path="/approvals" element={<Guard module="approvals"><ApprovalsPage /></Guard>} />
          <Route path="/portal/customer" element={<Guard module="customers"><CustomersPage /></Guard>} />
          <Route path="/portal/agent" element={<Guard module="agents"><AgentsPage /></Guard>} />
          <Route path="/reports" element={<Guard module="reports"><PlaceholderPage title="Reports" /></Guard>} />
          <Route path="/hr" element={<Guard module="hr"><HrPage /></Guard>} />
          <Route path="/settings" element={<Guard module="settings"><SettingsPage /></Guard>} />
          <Route path="/admin/users" element={<Guard module="users"><UsersRolesPage /></Guard>} />
          <Route path="/design-system" element={<DesignSystemPage />} />
          <Route path="*" element={<Navigate to={LANDING[user.role]} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

/** Shown to a signed-in Supabase user whose profile isn't yet Active —
    either awaiting Admin approval + role assignment, or suspended/rejected. */
function AccountStatusScreen({ kind, onSignOut }: { kind: 'pending' | 'suspended'; onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 text-center shadow-card">
        <h1 className="text-base font-semibold text-heading">
          {kind === 'pending' ? 'Awaiting Admin approval' : 'Account suspended'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {kind === 'pending'
            ? "You're signed in, but an Admin still needs to approve your account and assign you a role before you can access the app."
            : 'This account has been suspended. Contact your administrator if you believe this is a mistake.'}
        </p>
        <button
          onClick={onSignOut}
          className="mt-5 text-xs font-medium text-link hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
