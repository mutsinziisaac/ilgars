import { SidebarContent } from "./sidebar-content"

export function AppSidebar() {
  return (
    <aside className="sticky top-3 hidden h-[calc(100svh-1.5rem)] w-60 shrink-0 flex-col gap-3 rounded-2xl bg-sidebar p-3 text-sidebar-foreground shadow-lg shadow-sidebar/20 ring-1 ring-sidebar-border/60 lg:flex">
      <SidebarContent />
    </aside>
  )
}
