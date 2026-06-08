import { LayoutDashboard, Building2, FileText, ShieldAlert, Leaf, Wallet, Bot, UserCog, Store } from 'lucide-react'

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Suppliers', path: '/suppliers', icon: Building2 },
  { label: 'Contracts', path: '/contracts', icon: FileText },
  { label: 'Risk', path: '/risk', icon: ShieldAlert },
  { label: 'ESG', path: '/esg', icon: Leaf },
  { label: 'Spend', path: '/spend', icon: Wallet },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Bot },
  { label: 'Supplier Portal', path: '/portal', icon: Store },
  { label: 'Admin', path: '/admin', icon: UserCog },
]
