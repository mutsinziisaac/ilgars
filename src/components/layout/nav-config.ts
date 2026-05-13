import {
  FileText,
  LayoutGrid,
  Receipt,
  Route,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  path: string
  label: string
  icon: LucideIcon
  badge?: number
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: "/portal", label: "Overview", icon: LayoutGrid },
  { path: "/portal/fleet", label: "My trips", icon: Route },
  { path: "/portal/permits", label: "Permits", icon: FileText, badge: 2 },
  { path: "/portal/transactions", label: "Transactions", icon: Receipt },
] as const

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.path === "/portal"
      ? pathname === "/portal"
      : pathname.startsWith(item.path)
  )
}
