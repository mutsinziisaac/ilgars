import { useEffect, useMemo, useState, type ReactNode } from "react"
import type Keycloak from "keycloak-js"
import type { KeycloakProfile } from "keycloak-js"

import {
  type AuthUser,
  buildAuthUser,
  initKeycloakAuth,
  refreshKeycloakToken,
} from "@/lib/auth"
import { setAccessTokenProvider } from "@/lib/api"

import { AuthContext, type AuthContextValue } from "./auth-context"

type AuthState =
  | { status: "initializing" }
  | { status: "missing_config"; missingKeys: string[] }
  | { status: "error"; error: Error }
  | {
      status: "authenticated"
      keycloak: Keycloak
      profile: KeycloakProfile | null
      user: AuthUser
      token: string | null
    }

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
          <span className="text-sm font-semibold">IL</span>
        </div>
        <p className="text-sm font-medium text-foreground">Signing in</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Connecting to the identity provider…
        </p>
      </div>
    </div>
  )
}

function AuthErrorScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
            <span className="text-sm font-semibold">IL</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              Authentication unavailable
            </h1>
            <p className="text-xs text-muted-foreground">
              ILGARS transporter portal
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "initializing" })

  useEffect(() => {
    let active = true

    initKeycloakAuth()
      .then((result) => {
        if (!active) return

        if (result.status === "missing_config") {
          setState({
            status: "missing_config",
            missingKeys: result.missingKeys,
          })
          return
        }

        setAccessTokenProvider(() => refreshKeycloakToken())
        setState({
          status: "authenticated",
          keycloak: result.keycloak,
          profile: result.profile,
          user: result.user,
          token: result.keycloak.token ?? null,
        })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          status: "error",
          error:
            error instanceof Error
              ? error
              : new Error("Authentication failed."),
        })
      })

    return () => {
      active = false
      setAccessTokenProvider(null)
    }
  }, [])

  const value = useMemo<AuthContextValue | null>(() => {
    if (state.status !== "authenticated") return null

    const refreshToken = async (minValiditySeconds = 30) => {
      const token = await refreshKeycloakToken(minValiditySeconds)
      setState((current) =>
        current.status === "authenticated"
          ? {
              ...current,
              token,
              user: buildAuthUser(current.keycloak, current.profile),
            }
          : current
      )
      return token
    }

    return {
      keycloak: state.keycloak,
      authenticated: true,
      user: state.user,
      token: state.token,
      refreshToken,
      login: () => state.keycloak.login(),
      logout: () =>
        state.keycloak.logout({
          redirectUri: window.location.origin,
        }),
    }
  }, [state])

  if (state.status === "initializing") return <AuthLoadingScreen />

  if (state.status === "missing_config") {
    return (
      <AuthErrorScreen>
        <p className="text-sm text-foreground">
          Missing required Keycloak environment values.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {state.missingKeys.map((key) => (
            <li key={key}>
              <code>{key}</code>
            </li>
          ))}
        </ul>
      </AuthErrorScreen>
    )
  }

  if (state.status === "error") {
    return (
      <AuthErrorScreen>
        <p className="text-sm text-foreground">{state.error.message}</p>
      </AuthErrorScreen>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
