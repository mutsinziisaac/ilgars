import { Navigate, Route, Routes } from "react-router-dom"

import { AuthProvider } from "@/components/auth/auth-provider"
import { AppLayout } from "@/components/layout/app-layout"
import MyFleet from "@/pages/my-fleet"
import Overview from "@/pages/overview"
import PayCharges from "@/pages/pay-charges"
import Permits from "@/pages/permits"
import PublicTripLanding from "@/pages/public-trip-landing"
import Reports from "@/pages/reports"
import Transactions from "@/pages/transactions"
import VehicleDetail from "@/pages/vehicle-detail"
import VehicleNew from "@/pages/vehicle-new"

export function App() {
  return (
    <Routes>
      <Route index element={<PublicTripLanding />} />
      <Route
        path="portal"
        element={
          <AuthProvider>
            <AppLayout />
          </AuthProvider>
        }
      >
        <Route index element={<Overview />} />
        <Route path="fleet" element={<MyFleet />} />
        <Route path="fleet/new" element={<VehicleNew />} />
        <Route path="fleet/:vehicleId" element={<VehicleDetail />} />
        <Route path="pay-charges" element={<PayCharges />} />
        <Route path="permits" element={<Permits />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="reports" element={<Reports />} />
      </Route>
      <Route path="fleet/*" element={<Navigate to="/portal/fleet" replace />} />
      <Route
        path="pay-charges"
        element={<Navigate to="/portal/pay-charges" replace />}
      />
      <Route
        path="permits"
        element={<Navigate to="/portal/permits" replace />}
      />
      <Route
        path="transactions"
        element={<Navigate to="/portal/transactions" replace />}
      />
      <Route
        path="reports"
        element={<Navigate to="/portal/reports" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
