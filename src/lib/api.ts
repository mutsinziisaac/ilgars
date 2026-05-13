type AccessTokenProvider = (() => Promise<string>) | null

export type ApiRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: BodyInit | Record<string, unknown> | unknown[] | null
  headers?: HeadersInit
  skipAuth?: boolean
}

export class ApiError extends Error {
  readonly status: number
  readonly statusText: string
  readonly body: unknown
  readonly url: string

  constructor(input: {
    status: number
    statusText: string
    body: unknown
    url: string
  }) {
    super(`API request failed with ${input.status} ${input.statusText}`)
    this.name = "ApiError"
    this.status = input.status
    this.statusText = input.statusText
    this.body = input.body
    this.url = input.url
  }
}

let accessTokenProvider: AccessTokenProvider = null

export function setAccessTokenProvider(provider: AccessTokenProvider) {
  accessTokenProvider = provider
}

export function resolveApiBaseUrl(
  baseUrl: string | undefined,
  fallbackPath = ""
): string {
  const trimmed = (baseUrl ?? "").trim()
  const normalizedFallback = fallbackPath.replace(/\/+$/, "")
  if (!trimmed) return normalizedFallback

  if (/^https?:\/\//i.test(trimmed) && import.meta.env.DEV) {
    try {
      const url = new URL(trimmed)
      return `${url.pathname}${url.search}`.replace(/\/+$/, "")
    } catch {
      return normalizedFallback
    }
  }

  return trimmed.replace(/\/+$/, "")
}

function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith("/")) return path

  const baseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
  if (!baseUrl) return path

  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
}

function isJsonBody(
  body: ApiRequestOptions["body"]
): body is Record<string, unknown> | unknown[] {
  if (body === null || body === undefined) return false
  if (typeof body !== "object") return false
  if (body instanceof FormData) return false
  if (body instanceof Blob) return false
  if (body instanceof ArrayBuffer) return false
  if (body instanceof URLSearchParams) return false

  return true
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    return response.json()
  }

  const text = await response.text()
  return text === "" ? null : text
}

export async function apiRequest<T>(
  path: string,
  { body, headers, skipAuth = false, ...init }: ApiRequestOptions = {}
): Promise<T> {
  const requestHeaders = new Headers(headers)

  if (!skipAuth) {
    if (!accessTokenProvider) {
      throw new Error(
        "No access token provider is configured for API requests."
      )
    }

    const token = await accessTokenProvider()
    requestHeaders.set("Authorization", `Bearer ${token}`)
  }

  const requestInit: RequestInit = {
    ...init,
    headers: requestHeaders,
  }

  if (body !== undefined && body !== null) {
    if (isJsonBody(body)) {
      requestHeaders.set(
        "Content-Type",
        requestHeaders.get("Content-Type") ?? "application/json"
      )
      requestInit.body = JSON.stringify(body)
    } else {
      requestInit.body = body
    }
  }

  const url = resolveApiUrl(path)
  const response = await fetch(url, requestInit)
  const responseBody = await readResponseBody(response)

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      statusText: response.statusText,
      body: responseBody,
      url,
    })
  }

  return responseBody as T
}
