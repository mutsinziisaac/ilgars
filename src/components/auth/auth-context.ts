import { createContext, useContext } from "react"
import type Keycloak from "keycloak-js"

import type { AuthUser } from "@/lib/auth"

export type AuthContextValue = {
  keycloak: Keycloak
  authenticated: true
  user: AuthUser
  token: string | null
  refreshToken: (minValiditySeconds?: number) => Promise<string>
  login: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.")
  }

  return context
}
