/**
 * Spaceship API wrapper — async/await + retry + async-operation polling.
 *
 * Pattern:
 *  - Retry on 429 / 5xx / network error (max 2 retries)
 *  - 401/403 = non-retryable (bad credentials / permission)
 *  - Domain registration returns 202 + header `spaceship-async-operationid`
 *    → caller must poll `/v1/async-operations/{id}` via cron
 *  - Timeout 30s per request
 */
import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios"
import { TRPCError } from "@trpc/server"

const SPACESHIP_BASE_URL = "https://spaceship.dev/api/v1"
const REQUEST_TIMEOUT_MS = 30_000
const MAX_RETRIES = 2

export interface SpaceshipCredentials {
  apiKey: string
  apiSecret: string
}

export interface SpaceshipApiResult<T> {
  status: number
  data: T
  headers: Record<string, string>
}

export interface SpaceshipRegisterInput {
  domain: string
  contactId: string
  years?: number
}

export interface SpaceshipRenewInput {
  domain: string
  years: number
  currentExpirationDate: Date
}

export interface SpaceshipDnsRecord {
  type: string
  name: string
  value?: string
  address?: string
  ttl?: number
  [key: string]: unknown
}

export type AsyncOperationStatus = "pending" | "success" | "failed"

export interface AsyncOperationResult {
  operationId: string
  status: AsyncOperationStatus
  data?: unknown
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryable(status?: number): boolean {
  if (status === undefined) return true // network error
  if (status === 429) return true
  if (status >= 500 && status <= 599) return true
  return false
}

function getErrorMessage(data: unknown): string {
  if (typeof data === "object" && data && "message" in data) {
    const message = (data as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  if (typeof data === "object" && data && "detail" in data) {
    const detail = (data as { detail?: unknown }).detail
    if (typeof detail === "string" && detail.trim()) return detail
  }
  return "Spaceship API lỗi"
}

function extractHeaders(response: AxiosResponse): Record<string, string> {
  const result: Record<string, string> = {}
  if (response.headers) {
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof value === "string") result[key.toLowerCase()] = value
    }
  }
  return result
}

// ─── Core API caller with retry ─────────────────────────────────────────────

export async function spaceshipApiCall<T>(
  credentials: SpaceshipCredentials,
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: unknown
): Promise<SpaceshipApiResult<T>> {
  const cleanEndpoint = endpoint.replace(/^\/+/, "")
  const config: AxiosRequestConfig = {
    baseURL: SPACESHIP_BASE_URL,
    url: cleanEndpoint,
    method,
    timeout: REQUEST_TIMEOUT_MS,
    data: body,
    validateStatus: () => true, // handle status codes manually for retry
    headers: {
      "X-API-Key": credentials.apiKey.trim(),
      "X-API-Secret": credentials.apiSecret.trim(),
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "VanKhanh/1.0",
    },
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await axios.request<T>(config)
      // 2xx (including 202 async) = success
      if (response.status >= 200 && response.status < 300) {
        return {
          status: response.status,
          data: response.data,
          headers: extractHeaders(response),
        }
      }
      // Non-retryable errors
      if (!isRetryable(response.status) || attempt === MAX_RETRIES) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: getErrorMessage(response.data) })
      }
      lastError = new Error(getErrorMessage(response.data))
    } catch (error) {
      lastError = error
      if (error instanceof TRPCError) throw error
      const status = error instanceof AxiosError ? error.response?.status : undefined
      if (!isRetryable(status) || attempt === MAX_RETRIES) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: error instanceof Error ? error.message : "Spaceship API lỗi",
        })
      }
    }
    await sleep(300 * 2 ** attempt) // 300ms, 600ms
  }

  throw new TRPCError({
    code: "BAD_GATEWAY",
    message: lastError instanceof Error ? lastError.message : "Spaceship API lỗi",
  })
}

// ─── Async operation polling ────────────────────────────────────────────────

/**
 * Poll 1 lần status của async operation.
 * Trả về status: pending | success | failed
 */
export async function spaceshipGetAsyncOperation(
  credentials: SpaceshipCredentials,
  operationId: string
): Promise<AsyncOperationResult> {
  const result = await spaceshipApiCall<{ status?: string; [key: string]: unknown }>(
    credentials,
    "GET",
    `async-operations/${encodeURIComponent(operationId)}`
  )
  const status = (result.data?.status ?? "pending") as AsyncOperationStatus
  return {
    operationId,
    status: ["pending", "success", "failed"].includes(status) ? status : "pending",
    data: result.data,
  }
}

/**
 * Extract async operation ID từ response headers.
 * Spaceship trả header `spaceship-async-operationid` cho 202 responses.
 */
export function extractAsyncOperationId(headers: Record<string, string>): string | null {
  return headers["spaceship-async-operationid"] ?? null
}

// ─── Domain operations ──────────────────────────────────────────────────────

/**
 * Mua domain mới. Spaceship trả 202 + async operation ID.
 * Caller phải poll async operation để biết kết quả.
 */
export async function spaceshipBuyDomain(
  credentials: SpaceshipCredentials,
  input: SpaceshipRegisterInput
): Promise<SpaceshipApiResult<unknown>> {
  // API v2: domain nằm trong URL path → POST /v1/domains/{domain}
  // (KHÔNG truyền `name` trong body, nếu không Spaceship trả 404 "Unable to find a requested resource")
  return spaceshipApiCall(credentials, "POST", `domains/${encodeURIComponent(input.domain)}`, {
    autoRenew: false,
    years: input.years ?? 1,
    privacyProtection: { level: "high", userConsent: true },
    contacts: {
      registrant: input.contactId,
      admin: input.contactId,
      tech: input.contactId,
      billing: input.contactId,
    },
  })
}

export async function spaceshipRenewDomain(
  credentials: SpaceshipCredentials,
  input: SpaceshipRenewInput
): Promise<SpaceshipApiResult<unknown>> {
  return spaceshipApiCall(
    credentials,
    "POST",
    `domains/${encodeURIComponent(input.domain)}/renew`,
    {
      years: input.years,
      currentExpirationDate: input.currentExpirationDate.toISOString(),
    }
  )
}

export async function spaceshipGetNameservers(
  credentials: SpaceshipCredentials,
  domain: string
): Promise<SpaceshipApiResult<unknown>> {
  return spaceshipApiCall(credentials, "GET", `domains/${encodeURIComponent(domain)}/nameservers`)
}

export async function spaceshipUpdateNameservers(
  credentials: SpaceshipCredentials,
  domain: string,
  hosts: string[]
): Promise<SpaceshipApiResult<unknown>> {
  return spaceshipApiCall(credentials, "PUT", `domains/${encodeURIComponent(domain)}/nameservers`, {
    provider: "custom",
    hosts,
  })
}

export async function spaceshipGetDns(
  credentials: SpaceshipCredentials,
  domain: string
): Promise<SpaceshipApiResult<unknown>> {
  return spaceshipApiCall(
    credentials,
    "GET",
    `dns/records/${encodeURIComponent(domain)}?take=100&skip=0`
  )
}

export async function spaceshipSetDns(
  credentials: SpaceshipCredentials,
  domain: string,
  items: SpaceshipDnsRecord[]
): Promise<SpaceshipApiResult<unknown>> {
  return spaceshipApiCall(credentials, "PUT", `dns/records/${encodeURIComponent(domain)}`, {
    force: true,
    items,
  })
}

export async function spaceshipDeleteDns(
  credentials: SpaceshipCredentials,
  domain: string,
  record: SpaceshipDnsRecord
): Promise<SpaceshipApiResult<unknown>> {
  return spaceshipApiCall(credentials, "DELETE", `dns/records/${encodeURIComponent(domain)}`, [
    record,
  ])
}

// ─── Connection test (lightweight) ──────────────────────────────────────────

/**
 * Test API credentials bằng GET /domains?take=1.
 * Nhẹ nhất có thể — chỉ cần 200 = credentials OK.
 */
export async function spaceshipCheckConnection(
  credentials: SpaceshipCredentials
): Promise<SpaceshipApiResult<unknown>> {
  return spaceshipApiCall(credentials, "GET", "domains?take=1&skip=0")
}
