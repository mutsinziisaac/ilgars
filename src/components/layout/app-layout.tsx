import { Outlet } from "react-router-dom"

import { AppSidebar } from "./app-sidebar"
import { TopBar } from "./top-bar"

export function AppLayout() {
  return (
    <div className="flex min-h-svh gap-3 bg-background p-3">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-3 pt-4 pb-3">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
