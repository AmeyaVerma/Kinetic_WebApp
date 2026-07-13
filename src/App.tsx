import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { DesignSystemPage } from './pages/DesignSystemPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { NvoccPage } from './pages/NvoccPage'
import { BookingDetailPage } from './pages/BookingDetailPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { MnrPage } from './pages/MnrPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          {/* NVOCC */}
          <Route path="/nvocc" element={<NvoccPage />} />
          <Route path="/nvocc/:id" element={<BookingDetailPage />} />
          <Route path="/freight" element={<PlaceholderPage title="Freight FWD" />} />
          <Route path="/mnr" element={<MnrPage />} />
          <Route path="/accounts" element={<PlaceholderPage title="Accounts" />} />
          <Route path="/master" element={<PlaceholderPage title="Master Data" />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/portal/customer" element={<PlaceholderPage title="Customer Portal" />} />
          <Route path="/portal/agent" element={<PlaceholderPage title="Agent Portal" />} />
          <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
          <Route path="/hr" element={<PlaceholderPage title="HR" />} />
          <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          <Route path="/design-system" element={<DesignSystemPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
