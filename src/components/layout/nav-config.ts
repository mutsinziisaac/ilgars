import {
  FileText,
  LayoutGrid,
  Receipt,
  Truck,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  path: string
  label: string
  icon: LucideIcon
  badge?: number
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: "/", label: "Overview", icon: LayoutGrid },
  { path: "/fleet", label: "My fleet", icon: Truck },
  { path: "/permits", label: "Permits", icon: FileText, badge: 2 },
  { path: "/transactions", label: "Transactions", icon: Receipt },
] as const

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)
  )
}
