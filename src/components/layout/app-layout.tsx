import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Outlet } from "react-router-dom"

import { setHeavyVehicleThresholdFromPolicy } from "@/lib/fleet-vehicle-classification"
import { getActiveRucPolicy, MUNICIPALITY_ID } from "@/lib/trips-api"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

import { AppSidebar } from "./app-sidebar"
import { MobileNavContext } from "./mobile-nav-context"
import { SidebarContent } from "./sidebar-content"
import { TopBar } from "./top-bar"

export function AppLayout() {
  const { t } = useTranslation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const rucPolicyQuery = useQuery({
    queryKey: ["ruc-policy", MUNICIPALITY_ID],
    queryFn: () => getActiveRucPolicy(MUNICIPALITY_ID),
    enabled: !!MUNICIPALITY_ID,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    const policy = rucPolicyQuery.data
    if (!policy) return
    setHeavyVehicleThresholdFromPolicy(
      Number(policy.specialPermitCapacityThreshold),
      policy.specialPermitCapacityUnit
    )
  }, [rucPolicyQuery.data])

  return (
    <MobileNavContext.Provider
      value={{ open: mobileNavOpen, setOpen: setMobileNavOpen }}
    >
      <div className="flex min-h-svh gap-3 bg-background p-3">
        <AppSidebar />
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="flex w-[280px] flex-col gap-3 bg-sidebar p-3 text-sidebar-foreground sm:max-w-[280px]"
          >
            <SheetTitle className="sr-only">{t("shell.menu")}</SheetTitle>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 px-3 pt-4 pb-3">
            <Outlet />
          </main>
        </div>
      </div>
    </MobileNavContext.Provider>
  )
}
