import {
  LayoutDashboard,
  Anchor,
  Boxes,
  Container,
  Wallet,
  Database,
  ClipboardCheck,
  Users,
  UserCog,
  FileBarChart2,
  Contact,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  badgeKey?: 'approvals'
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'NVOCC', path: '/nvocc', icon: Anchor },
  { label: 'Freight FWD', path: '/freight', icon: Boxes },
  { label: 'MNR (Container)', path: '/mnr', icon: Container },
  { label: 'Accounts', path: '/accounts', icon: Wallet },
  { label: 'Customers', path: '/customers', icon: Contact },
  { label: 'Master Data', path: '/master', icon: Database },
  { label: 'Approvals', path: '/approvals', icon: ClipboardCheck, badgeKey: 'approvals' },
  { label: 'Customer Portal', path: '/portal/customer', icon: Users },
  { label: 'Agent Portal', path: '/portal/agent', icon: UserCog },
  { label: 'Reports', path: '/reports', icon: FileBarChart2 },
  { label: 'HR', path: '/hr', icon: Contact },
  { label: 'Settings', path: '/settings', icon: Settings },
]
