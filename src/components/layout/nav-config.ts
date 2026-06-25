import { FileText, LayoutGrid, Truck, type LucideIcon } from "lucide-react"

export type NavItem = {
  path: string
  labelKey: string
  icon: LucideIcon
  badge?: number
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: "/portal", labelKey: "nav.overview", icon: LayoutGrid },
  { path: "/portal/fleet", labelKey: "nav.myFleet", icon: Truck },
  { path: "/portal/permits", labelKey: "nav.permits", icon: FileText },
] as const

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.path === "/portal"
      ? pathname === "/portal"
      : pathname.startsWith(item.path)
  )
}
