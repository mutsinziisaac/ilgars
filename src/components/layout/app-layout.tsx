import { Outlet } from "react-router-dom"

import { AppSidebar } from "./app-sidebar"
import { TopBar } from "./top-bar"

export function AppLayout() {
  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-6 pt-5 pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
