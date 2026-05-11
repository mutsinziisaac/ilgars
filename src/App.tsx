import { Navigate, Route, Routes } from "react-router-dom"

import { AppLayout } from "@/components/layout/app-layout"
import MyFleet from "@/pages/my-fleet"
import Overview from "@/pages/overview"
import PayCharges from "@/pages/pay-charges"
import Permits from "@/pages/permits"
import Reports from "@/pages/reports"
import Transactions from "@/pages/transactions"
import VehicleDetail from "@/pages/vehicle-detail"
import VehicleNew from "@/pages/vehicle-new"

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Overview />} />
        <Route path="fleet" element={<MyFleet />} />
        <Route path="fleet/new" element={<VehicleNew />} />
        <Route path="fleet/:plate" element={<VehicleDetail />} />
        <Route path="pay-charges" element={<PayCharges />} />
        <Route path="permits" element={<Permits />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
