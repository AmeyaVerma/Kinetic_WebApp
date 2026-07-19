import {
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
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleKey } from '../../lib/rbac'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  module: ModuleKey
  badgeKey?: 'approvals'
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'NVOCC', path: '/nvocc', icon: Anchor, module: 'nvocc' },
  { label: 'Freight FWD', path: '/freight', icon: Boxes, module: 'freight' },
  { label: 'MNR (Container)', path: '/mnr', icon: Container, module: 'mnr' },
  { label: 'Accounts', path: '/accounts', icon: Wallet, module: 'accounts' },
  { label: 'Master Data', path: '/master', icon: Database, module: 'master' },
  { label: 'Approvals', path: '/approvals', icon: ClipboardCheck, module: 'approvals', badgeKey: 'approvals' },
  { label: 'Customer Portal', path: '/portal/customer', icon: Users, module: 'customers' },
  { label: 'Agent Portal', path: '/portal/agent', icon: UserCog, module: 'agents' },
  { label: 'Reports', path: '/reports', icon: FileBarChart2, module: 'reports' },
  { label: 'HR', path: '/hr', icon: Contact, module: 'hr' },
  { label: 'Users & Roles', path: '/admin/users', icon: ShieldCheck, module: 'users' },
  { label: 'Settings', path: '/settings', icon: Settings, module: 'settings' },
]
