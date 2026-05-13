import Keycloak, {
  type KeycloakInitOptions,
  type KeycloakProfile,
  type KeycloakTokenParsed,
} from "keycloak-js"

type KeycloakEnvConfig = {
  url: string
  realm: string
  clientId: string
}

export type AuthUser = {
  id: string | null
  username: string | null
  email: string | null
  firstName: string | null
  lastName: string | null
  displayName: string
  initials: string
  chestId: string | null
  emailVerified: boolean | null
}

type AuthInitResult =
  | {
      status: "authenticated"
      keycloak: Keycloak
      profile: KeycloakProfile | null
      user: AuthUser
    }
  | {
      status: "missing_config"
      missingKeys: string[]
    }

let keycloakInstance: Keycloak | null = null
let initPromise: Promise<AuthInitResult> | null = null

const REQUIRED_ENV_KEYS = [
  "VITE_KEYCLOAK_URL",
  "VITE_KEYCLOAK_REALM",
  "VITE_KEYCLOAK_CLIENT_ID",
] as const

function readEnvValue(key: (typeof REQUIRED_ENV_KEYS)[number]): string {
  return (import.meta.env[key] ?? "").trim()
}

function getKeycloakConfig():
  | { config: KeycloakEnvConfig; missingKeys: [] }
  | { config: null; missingKeys: string[] } {
  const values = {
    url: readEnvValue("VITE_KEYCLOAK_URL"),
    realm: readEnvValue("VITE_KEYCLOAK_REALM"),
    clientId: readEnvValue("VITE_KEYCLOAK_CLIENT_ID"),
  }
  const missingKeys = REQUIRED_ENV_KEYS.filter(
    (key) => readEnvValue(key) === ""
  )

  if (missingKeys.length > 0) {
    return { config: null, missingKeys }
  }

  return { config: values, missingKeys: [] }
}

function getKeycloak(): Keycloak {
  if (keycloakInstance) return keycloakInstance

  const result = getKeycloakConfig()
  if (!result.config) {
    throw new Error(`Missing Keycloak config: ${result.missingKeys.join(", ")}`)
  }

  keycloakInstance = new Keycloak(result.config)
  keycloakInstance.onTokenExpired = () => {
    void keycloakInstance?.updateToken(30).catch(() => {
      keycloakInstance?.clearToken()
      void keycloakInstance?.login()
    })
  }

  return keycloakInstance
}

function getStringClaim(
  claims: KeycloakTokenParsed | undefined,
  claimName: string
): string | null {
  const value = claims?.[claimName] as unknown
  return typeof value === "string" && value.trim() !== "" ? value : null
}

function buildInitials(displayName: string): string {
  const parts = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return "U"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function buildAuthUser(
  keycloak: Keycloak,
  profile: KeycloakProfile | null
): AuthUser {
  const username =
    profile?.username ??
    getStringClaim(keycloak.tokenParsed, "preferred_username")
  const email = profile?.email ?? getStringClaim(keycloak.tokenParsed, "email")
  const firstName =
    profile?.firstName ?? getStringClaim(keycloak.tokenParsed, "given_name")
  const lastName =
    profile?.lastName ?? getStringClaim(keycloak.tokenParsed, "family_name")
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    getStringClaim(keycloak.tokenParsed, "name") ||
    username ||
    email ||
    "Authenticated user"

  return {
    id:
      profile?.id ??
      keycloak.subject ??
      getStringClaim(keycloak.tokenParsed, "sub"),
    username,
    email,
    firstName,
    lastName,
    displayName,
    initials: buildInitials(displayName),
    chestId:
      getStringClaim(keycloak.tokenParsed, "chest_id") ??
      getStringClaim(keycloak.tokenParsed, "chestId"),
    emailVerified:
      profile?.emailVerified ??
      (typeof keycloak.tokenParsed?.email_verified === "boolean"
        ? keycloak.tokenParsed.email_verified
        : null),
  }
}

export function initKeycloakAuth(): Promise<AuthInitResult> {
  if (initPromise) return initPromise

  const result = getKeycloakConfig()
  if (!result.config) {
    initPromise = Promise.resolve({
      status: "missing_config",
      missingKeys: result.missingKeys,
    })
    return initPromise
  }

  const keycloak = getKeycloak()
  const initOptions: KeycloakInitOptions = {
    onLoad: "login-required",
    pkceMethod: "S256",
    checkLoginIframe: false,
  }

  initPromise = keycloak.init(initOptions).then(async (authenticated) => {
    if (!authenticated) {
      await keycloak.login()
    }

    const profile = await keycloak.loadUserProfile().catch(() => null)
    return {
      status: "authenticated",
      keycloak,
      profile,
      user: buildAuthUser(keycloak, profile),
    }
  })

  return initPromise
}

export async function refreshKeycloakToken(
  minValiditySeconds = 30
): Promise<string> {
  const keycloak = getKeycloak()

  try {
    await keycloak.updateToken(minValiditySeconds)
  } catch (error) {
    keycloak.clearToken()
    throw error
  }

  if (!keycloak.token) {
    throw new Error("Keycloak did not return an access token.")
  }

  return keycloak.token
}

export function getActiveKeycloak(): Keycloak | null {
  return keycloakInstance
}
