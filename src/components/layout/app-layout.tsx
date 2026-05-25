import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Outlet } from "react-router-dom"

import { setHeavyVehicleThresholdFromPolicy } from "@/lib/fleet-vehicle-classification"
import { getActiveRucPolicy, MUNICIPALITY_ID } from "@/lib/trips-api"

import { AppSidebar } from "./app-sidebar"
import { TopBar } from "./top-bar"

export function AppLayout() {
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
