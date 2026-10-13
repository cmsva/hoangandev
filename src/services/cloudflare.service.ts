import axios, { AxiosError, type AxiosRequestConfig } from "axios"
import { TRPCError } from "@trpc/server"

const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4"
const REQUEST_TIMEOUT_MS = 15_000
const MAX_RETRIES = 3
const RATE_LIMIT_RULE_DESCRIPTION = "Auto anti-DDoS rate limit"
const RATE_LIMIT_RULE_EXPRESSION = 'cf.zone.name ne ""'


export interface CloudflareCredentials {
  apiToken: string
  accountId?: string | null
  authEmail?: string | null
  authMode?: "apiToken" | "globalKey"
}

export interface CloudflareZoneResult {
  zoneId: string
  nameServers: string[]
}

export type CloudflareAnalyticsRange = "24h" | "7d" | "30d"

export interface CloudflareZoneSummary {
  id: string
  name: string
  status: string
  paused: boolean
  type: string
  nameServers: string[]
}

export interface CloudflareDnsRecordSummary {
  id: string
  type: string
  name: string
  content: string
  proxied: boolean
  ttl: number
}

export interface CloudflareAnalyticsSummary {
  uniqueVisitors: number
  uniqueIps: number
  requests: number
  bandwidthBytes: number
  cachedPercent: number
  cachedBytes: number
  requestSeries: Array<{ label: string; requests: number; visitors: number }>
  trafficSeries: Array<{ label: string; bandwidthBytes: number; cachedBytes: number }>
}
function cloudflareHeaders(credentials: CloudflareCredentials): Record<string, string> {
  if (credentials.authMode === "globalKey") {
    if (!credentials.authEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu Cloudflare email" })
    return { "X-Auth-Email": credentials.authEmail, "X-Auth-Key": credentials.apiToken, "Content-Type": "application/json" }
  }
  return { Authorization: `Bearer ${credentials.apiToken}`, "Content-Type": "application/json" }
}

interface CloudflareEnvelope<T> {
  success?: boolean
  errors?: Array<{ code?: number; message?: string }>
  result?: T
  result_info?: { page: number; per_page: number; total_pages: number; count: number; total_count: number }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetry(status?: number): boolean {
  return status === 429 || status === undefined || (status >= 500 && status <= 599)
}

function toCloudflareErrorMessage(errors?: Array<{ message?: string }>): string {
  return errors?.map((error) => error.message).filter(Boolean).join("; ") || "Cloudflare API lỗi"
}

/**
 * CloudflareApiError — bảo lưu status code và error.code (CF API error code)
 * để caller biết mà retaí hoặc xử lý các case đặc biệt (vd 10003 = "entrypoint missing").
 */
export class CloudflareApiError extends Error {
  status?: number
  cfErrors: Array<{ code?: number; message?: string }>
  constructor(message: string, status: number | undefined, cfErrors: Array<{ code?: number; message?: string }>) {
    super(message)
    this.name = "CloudflareApiError"
    this.status = status
    this.cfErrors = cfErrors
  }
  hasCode(code: number): boolean {
    return this.cfErrors.some((e) => e.code === code)
  }
}

async function cfFetchWithMeta<T>(path: string, credentials: CloudflareCredentials, init?: AxiosRequestConfig): Promise<CloudflareEnvelope<T>> {
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await axios.request<CloudflareEnvelope<T>>({
        baseURL: CLOUDFLARE_API_BASE_URL,
        url: path,
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
        ...init,
        headers: {
          ...cloudflareHeaders(credentials),
          ...(init?.headers ?? {}),
        },
      })
      const payload = response.data
      if (response.status >= 200 && response.status < 300 && payload?.success !== false) return payload
      if (!shouldRetry(response.status) || attempt === MAX_RETRIES) {
        const cfErrors = payload?.errors ?? []
        // Log: chỉ log warn cho 404 missing-entrypoint (không spam error)
        const isMissingEntrypoint = response.status === 404 && cfErrors.some((e) => e.code === 10003)
        if (!isMissingEntrypoint) {
          console.error("Cloudflare API failed", { endpoint: path, status: response.status, errors: cfErrors })
        }
        throw new CloudflareApiError(toCloudflareErrorMessage(cfErrors), response.status, cfErrors)
      }
      lastError = new Error(toCloudflareErrorMessage(payload?.errors))
    } catch (error) {
      if (error instanceof CloudflareApiError) throw error
      lastError = error
      const status = error instanceof AxiosError ? error.response?.status : undefined
      if (!shouldRetry(status) || attempt === MAX_RETRIES) {
        const errors = error instanceof AxiosError ? (error.response?.data as CloudflareEnvelope<unknown> | undefined)?.errors ?? [] : []
        console.error("Cloudflare API failed", { endpoint: path, status, errors, message: error instanceof Error ? error.message : String(error) })
        throw new CloudflareApiError(
          error instanceof Error ? error.message : "Cloudflare API lỗi",
          status,
          errors
        )
      }
    }
    await sleep(250 * 2 ** attempt)
  }

  throw new CloudflareApiError(
    lastError instanceof Error ? lastError.message : "Cloudflare API lỗi",
    undefined,
    []
  )
}

async function cfFetch<T>(path: string, credentials: CloudflareCredentials, init?: AxiosRequestConfig): Promise<T> {
  try {
    const envelope = await cfFetchWithMeta<T>(path, credentials, init)
    return envelope.result as T
  } catch (err) {
    if (err instanceof CloudflareApiError) {
      throw new TRPCError({ code: "BAD_GATEWAY", message: err.message, cause: err })
    }
    throw err
  }
}

async function cfGraphql<T>(credentials: CloudflareCredentials, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: cloudflareHeaders(credentials),
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const json = (await res.json().catch(() => null)) as { data?: T; errors?: Array<{ message?: string }> } | null
  if (!res.ok || json?.errors?.length) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: json?.errors?.[0]?.message ?? "Cloudflare Analytics lỗi" })
  }
  if (!json?.data) throw new TRPCError({ code: "BAD_GATEWAY", message: "Cloudflare Analytics rỗng" })
  return json.data
}

export function getRootDomain(domainName: string): string {
  const parts = domainName.toLowerCase().split(".").filter(Boolean)
  return parts.length <= 2 ? parts.join(".") : parts.slice(-2).join(".")
}

export function getRecordName(domainName: string, rootDomain: string): string {
  return domainName === rootDomain ? "@" : domainName.slice(0, -(rootDomain.length + 1))
}

export async function verifyCloudflareToken(credentials: CloudflareCredentials): Promise<boolean> {
  const path = credentials.authMode === "globalKey" ? "/user" : "/user/tokens/verify"
  await cfFetch<Record<string, unknown>>(path, credentials)
  return true
}

export async function ensureCloudflareZone(credentials: CloudflareCredentials, rootDomain: string): Promise<CloudflareZoneResult> {
  const existing = await cfFetch<Array<{ id: string; name_servers?: string[] }>>(`/zones?name=${encodeURIComponent(rootDomain)}`, credentials)
  const zone = existing[0]
  if (zone) return { zoneId: zone.id, nameServers: zone.name_servers ?? [] }

  const created = await cfFetch<{ id: string; name_servers?: string[] }>("/zones", credentials, {
    method: "POST",
    data: {
      name: rootDomain,
      ...(credentials.accountId ? { account: { id: credentials.accountId } } : {}),
      jump_start: false,
    },
  })
  return { zoneId: created.id, nameServers: created.name_servers ?? [] }
}
export async function upsertCloudflareARecord(input: CloudflareCredentials & { zoneId: string; name: string; content: string; proxied?: boolean; ttl?: number }): Promise<string> {
  const records = await cfFetch<Array<{ id: string }>>(`/zones/${input.zoneId}/dns_records?type=A&name=${encodeURIComponent(input.name)}`, input)
  const payload = { type: "A", name: input.name, content: input.content, ttl: input.ttl ?? 1, proxied: input.proxied ?? false }
  if (records[0]) {
    const updated = await cfFetch<{ id: string }>(`/zones/${input.zoneId}/dns_records/${records[0].id}`, input, { method: "PUT", data: payload })
    return updated.id
  }
  const created = await cfFetch<{ id: string }>(`/zones/${input.zoneId}/dns_records`, input, { method: "POST", data: payload })
  return created.id
}

export async function getCloudflareZoneDetails(input: CloudflareCredentials & { rootDomain: string }): Promise<{ zoneId: string; status: string; nameServers: string[] }> {
  const zones = await cfFetch<Array<{ id: string; status?: string; name_servers?: string[] }>>(`/zones?name=${encodeURIComponent(input.rootDomain)}`, input)
  const zone = zones[0]
  if (!zone) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy zone Cloudflare" })
  return { zoneId: zone.id, status: zone.status ?? "unknown", nameServers: zone.name_servers ?? [] }
}

export async function checkCloudflareNsStatus(input: CloudflareCredentials & { domainName: string }): Promise<{ ok: boolean; expected: string[]; current: string }> {
  const rootDomain = getRootDomain(input.domainName)
  const zone = await getCloudflareZoneDetails({ ...input, rootDomain })
  return { ok: zone.status === "active", expected: zone.nameServers, current: zone.status }
}

export async function listCloudflareZones(input: CloudflareCredentials & { page?: number; limit?: number }): Promise<CloudflareZoneSummary[]> {
  const limit = input.limit ?? 50
  const startPage = input.page ?? 1
  const allZones: Array<{ id: string; name: string; status?: string; paused?: boolean; type?: string; name_servers?: string[] }> = []
  let page = startPage
  let totalPages = startPage

  try {
    do {
      const envelope = await cfFetchWithMeta<Array<{ id: string; name: string; status?: string; paused?: boolean; type?: string; name_servers?: string[] }>>(
        `/zones?page=${page}&per_page=${limit}&order=name&direction=asc`,
        input
      )
      allZones.push(...(envelope.result ?? []))
      totalPages = input.page ? page : envelope.result_info?.total_pages ?? page
      page += 1
    } while (!input.page && page <= totalPages)
  } catch (err) {
    if (err instanceof CloudflareApiError) {
      throw new TRPCError({ code: "BAD_GATEWAY", message: err.message, cause: err })
    }
    throw err
  }

  return allZones.map((zone) => ({ id: zone.id, name: zone.name, status: zone.status ?? "unknown", paused: zone.paused ?? false, type: zone.type ?? "full", nameServers: zone.name_servers ?? [] }))
}

export async function listCloudflareDnsRecords(input: CloudflareCredentials & { zoneId: string }): Promise<CloudflareDnsRecordSummary[]> {
  const records = await cfFetch<Array<{ id: string; type: string; name: string; content: string; proxied?: boolean; ttl?: number }>>(
    `/zones/${input.zoneId}/dns_records?per_page=100&order=type&direction=asc`,
    input
  )
  return records.map((record) => ({ id: record.id, type: record.type, name: record.name, content: record.content, proxied: record.proxied ?? false, ttl: record.ttl ?? 1 }))
}
function getRangeStart(range: CloudflareAnalyticsRange): string {
  const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function getDailyRangeStart(range: CloudflareAnalyticsRange): string {
  const days = range === "24h" ? 1 : range === "7d" ? 7 : 30
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return date.toISOString().slice(0, 10)
}

function formatBucketLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return value.includes("T") ? date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
}

interface AnalyticsGraphqlResponse {
  viewer: {
    zones: Array<{
      totals: Array<{ count?: number; sum?: { requests?: number; visits?: number; edgeResponseBytes?: number; bytes?: number; cachedBytes?: number } }>
      series: Array<{ count?: number; dimensions?: { datetimeHour?: string; date?: string }; sum?: { requests?: number; visits?: number; edgeResponseBytes?: number; bytes?: number; cachedBytes?: number } }>
      cache: Array<{ count?: number; dimensions?: { cacheStatus?: string }; sum?: { requests?: number; edgeResponseBytes?: number; bytes?: number } }>
    }>
  }
}

export async function getCloudflareAnalytics(input: CloudflareCredentials & { zoneIds: string[]; range: CloudflareAnalyticsRange }): Promise<CloudflareAnalyticsSummary> {
  if (input.zoneIds.length === 0) return { uniqueVisitors: 0, uniqueIps: 0, requests: 0, bandwidthBytes: 0, cachedPercent: 0, cachedBytes: 0, requestSeries: [], trafficSeries: [] }
  const isDailyRange = input.range !== "24h"
  const since = isDailyRange ? getDailyRangeStart(input.range) : getRangeStart(input.range)
  const until = isDailyRange ? new Date().toISOString().slice(0, 10) : new Date().toISOString()
  const dataset = isDailyRange ? "httpRequests1dGroups" : "httpRequestsAdaptiveGroups"
  const groupBy = isDailyRange ? "date" : "datetimeHour"
  const sumFields = isDailyRange ? "requests bytes cachedBytes" : "visits edgeResponseBytes"
  const filterTime = isDailyRange ? "date_geq: $since, date_leq: $until" : "datetime_geq: $since, datetime_leq: $until, requestSource: \"eyeball\""
  const query = `query ZoneTraffic($zoneIds: [String!], $since: ${isDailyRange ? "Date" : "Time"}!, $until: ${isDailyRange ? "Date" : "Time"}!) {
    viewer {
      zones(filter: { zoneTag_in: $zoneIds }) {
        totals: ${dataset}(limit: 1, filter: { ${filterTime} }) {
          ${isDailyRange ? "" : "count"}
          sum { ${sumFields} }
        }
        series: ${dataset}(limit: 1000, filter: { ${filterTime} }, orderBy: [${groupBy}_ASC]) {
          ${isDailyRange ? "" : "count"}
          dimensions { ${groupBy} }
          sum { ${sumFields} }
        }
        ${isDailyRange ? "" : `cache: ${dataset}(limit: 20, filter: { ${filterTime} }) {
          count
          dimensions { cacheStatus }
          sum { edgeResponseBytes }
        }`}
      }
    }
  }`
  const data = await cfGraphql<AnalyticsGraphqlResponse>(input, query, { zoneIds: input.zoneIds, since, until })
  const buckets = new Map<string, { requests: number; visitors: number; bandwidthBytes: number; cachedBytes: number }>()
  let uniqueIps = 0
  let requests = 0
  let visits = 0
  let bandwidthBytes = 0
  let cachedBytes = 0

  for (const zone of data.viewer.zones) {
    const total = zone.totals[0]
    uniqueIps += total?.sum?.visits ?? total?.count ?? total?.sum?.requests ?? 0
    requests += total?.count ?? total?.sum?.requests ?? 0
    visits += total?.sum?.visits ?? 0
    bandwidthBytes += total?.sum?.edgeResponseBytes ?? total?.sum?.bytes ?? 0
    cachedBytes += total?.sum?.cachedBytes ?? (zone.cache ?? []).reduce((totalCached, row) => {
      const cacheStatus = row.dimensions?.cacheStatus ?? ""
      return totalCached + (cacheStatus === "hit" ? row.sum?.edgeResponseBytes ?? row.sum?.bytes ?? 0 : 0)
    }, 0)
    for (const row of zone.series) {
      const key = row.dimensions?.datetimeHour ?? row.dimensions?.date ?? "unknown"
      const bucket = buckets.get(key) ?? { requests: 0, visitors: 0, bandwidthBytes: 0, cachedBytes: 0 }
      bucket.requests += row.count ?? row.sum?.requests ?? 0
      bucket.visitors += row.sum?.visits ?? 0
      bucket.bandwidthBytes += row.sum?.edgeResponseBytes ?? row.sum?.bytes ?? 0
      bucket.cachedBytes += row.sum?.cachedBytes ?? 0
      buckets.set(key, bucket)
    }
  }

  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b))
  return {
    uniqueVisitors: visits || uniqueIps,
    uniqueIps,
    requests,
    bandwidthBytes,
    cachedPercent: bandwidthBytes > 0 ? Math.round((cachedBytes / bandwidthBytes) * 1000) / 10 : 0,
    cachedBytes,
    requestSeries: sorted.map(([key, value]) => ({ label: formatBucketLabel(key), requests: value.requests, visitors: value.visitors })),
    trafficSeries: sorted.map(([key, value]) => ({ label: formatBucketLabel(key), bandwidthBytes: value.bandwidthBytes, cachedBytes: value.cachedBytes })),
  }
}

export interface CloudflareDnsRecordInput {
  type: "A" | "AAAA" | "CNAME" | "TXT" | "MX"
  name: string
  content: string
  proxied?: boolean
  ttl?: number
}

export async function createCloudflareDnsRecord(input: CloudflareCredentials & { zoneId: string; record: CloudflareDnsRecordInput }): Promise<CloudflareDnsRecordSummary> {
  const created = await cfFetch<{ id: string; type: string; name: string; content: string; proxied?: boolean; ttl?: number }>(`/zones/${input.zoneId}/dns_records`, input, {
    method: "POST",
    data: { ...input.record, ttl: input.record.ttl ?? 1, proxied: input.record.proxied ?? false },
  })
  return { id: created.id, type: created.type, name: created.name, content: created.content, proxied: created.proxied ?? false, ttl: created.ttl ?? 1 }
}

export async function updateCloudflareDnsRecord(input: CloudflareCredentials & { zoneId: string; recordId: string; record: CloudflareDnsRecordInput }): Promise<CloudflareDnsRecordSummary> {
  const updated = await cfFetch<{ id: string; type: string; name: string; content: string; proxied?: boolean; ttl?: number }>(`/zones/${input.zoneId}/dns_records/${input.recordId}`, input, {
    method: "PUT",
    data: { ...input.record, ttl: input.record.ttl ?? 1, proxied: input.record.proxied ?? false },
  })
  return { id: updated.id, type: updated.type, name: updated.name, content: updated.content, proxied: updated.proxied ?? false, ttl: updated.ttl ?? 1 }
}

export async function deleteCloudflareDnsRecord(input: CloudflareCredentials & { zoneId: string; recordId: string }): Promise<boolean> {
  await cfFetch<{ id: string }>(`/zones/${input.zoneId}/dns_records/${input.recordId}`, input, { method: "DELETE" })
  return true
}

interface CloudflareSecurityLevel {
  id: string
  value: string
}

interface CloudflareRateLimitRule {
  id?: string
  action: string
  expression: string
  description?: string
  enabled?: boolean
  ratelimit?: {
    characteristics?: string[]
    period?: number
    requests_per_period?: number
    mitigation_timeout?: number
  }
}

interface CloudflareRuleset {
  id: string
  name: string
  kind: "zone"
  phase: "http_ratelimit"
  rules: CloudflareRateLimitRule[]
}

export async function getCloudflareSecurityLevel(input: CloudflareCredentials & { zoneId: string }): Promise<string> {
  const setting = await cfFetch<CloudflareSecurityLevel>(`/zones/${input.zoneId}/settings/security_level`, input)
  return setting.value
}

export async function setCloudflareChallengeMode(input: CloudflareCredentials & { zoneId: string; enabled: boolean }): Promise<{ status: "already_enabled" | "enabled" | "disabled" }> {
  const current = await getCloudflareSecurityLevel(input)
  if (input.enabled && current === "under_attack") {
    console.info("Cloudflare Under Attack already enabled", { zoneId: input.zoneId })
    return { status: "already_enabled" }
  }
  await cfFetch<CloudflareSecurityLevel>(`/zones/${input.zoneId}/settings/security_level`, input, {
    method: "PATCH",
    data: { value: input.enabled ? "under_attack" : "medium" },
  })
  console.info(input.enabled ? "Cloudflare Under Attack enabled" : "Cloudflare Under Attack disabled", { zoneId: input.zoneId })
  return { status: input.enabled ? "enabled" : "disabled" }
}

/**
 * Lấy http_ratelimit entrypoint ruleset của zone.
 *
 * Cloudflare quirk: nếu phase chưa có rule nào, GET endpoint trả **404 + code 10003**
 * ("could not find entrypoint ruleset"). Đây là expected behaviour, không phải error.
 *
 * Trong trường hợp đó ta auto-create empty ruleset bằng `POST /zones/{id}/rulesets`
 * (lưu ý: PUT vào entrypoint endpoint không hợp lệ cho create — phải POST list).
 *
 * Docs: https://developers.cloudflare.com/ruleset-engine/rulesets-api/create/
 */
export async function getCloudflareRateLimitEntrypoint(input: CloudflareCredentials & { zoneId: string }): Promise<CloudflareRuleset> {
  try {
    const envelope = await cfFetchWithMeta<CloudflareRuleset>(`/zones/${input.zoneId}/rulesets/phases/http_ratelimit/entrypoint`, input)
    return envelope.result as CloudflareRuleset
  } catch (error) {
    // Detect missing-entrypoint: status 404 + cf error code 10003
    const isMissingEntrypoint =
      error instanceof CloudflareApiError &&
      (error.status === 404 || error.hasCode(10003) || /could not find entrypoint|not\s+found/i.test(error.message))
    if (!isMissingEntrypoint) {
      // Real error — wrap thanh TRPCError
      if (error instanceof CloudflareApiError) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: error.message, cause: error })
      }
      throw error
    }

    // Auto-create empty entrypoint ruleset
    try {
      const created = await cfFetch<CloudflareRuleset>(`/zones/${input.zoneId}/rulesets`, input, {
        method: "POST",
        data: {
          name: "default",
          description: "Managed rate-limit ruleset (auto-created)",
          kind: "zone",
          phase: "http_ratelimit",
          rules: [],
        },
      })
      return { ...created, rules: created.rules ?? [] }
    } catch (createError) {
      // Một số plan free không cho tạo rate-limit ruleset — return empty fallback
      console.warn("Cloudflare: cannot auto-create rate-limit entrypoint", {
        zoneId: input.zoneId,
        error: createError instanceof Error ? createError.message : String(createError),
      })
      return {
        id: "",
        name: "default",
        kind: "zone",
        phase: "http_ratelimit",
        rules: [],
      }
    }
  }
}

function isManagedRateLimitRule(rule: CloudflareRateLimitRule): boolean {
  return rule.action === "block" && rule.ratelimit?.period === 10 && rule.ratelimit.requests_per_period === 150
}

export async function getCloudflareProtectionStatus(input: CloudflareCredentials & { zoneId: string }): Promise<{ challengeEnabled: boolean; rateLimitEnabled: boolean; securityLevel: string }> {
  const [securityLevel, rateLimitEntrypoint] = await Promise.all([
    getCloudflareSecurityLevel(input),
    getCloudflareRateLimitEntrypoint(input),
  ])
  return {
    challengeEnabled: securityLevel === "under_attack",
    rateLimitEnabled: (rateLimitEntrypoint.rules ?? []).some(isManagedRateLimitRule),
    securityLevel,
  }
}

export async function setCloudflareRateShield(input: CloudflareCredentials & { zoneId: string; enabled: boolean }): Promise<{ status: "already_exists" | "enabled" | "disabled" }> {
  const entrypoint = await getCloudflareRateLimitEntrypoint(input)
  const existingRules = entrypoint.rules ?? []
  const hasRule = existingRules.some(isManagedRateLimitRule)

  if (input.enabled && hasRule) {
    console.info("Cloudflare rate limit already exists", { zoneId: input.zoneId, rulesetId: entrypoint.id })
    return { status: "already_exists" }
  }

  // Disable + không có rule → no-op (entrypoint có thể rỗng và id="")
  if (!input.enabled && !hasRule) {
    return { status: "disabled" }
  }

  const newRule: CloudflareRateLimitRule = {
    description: RATE_LIMIT_RULE_DESCRIPTION,
    expression: RATE_LIMIT_RULE_EXPRESSION,
    action: "block",
    enabled: true,
    ratelimit: {
      characteristics: ["ip.src"],
      period: 10,
      requests_per_period: 150,
      mitigation_timeout: 10,
    },
  }

  const rules = input.enabled
    ? [...existingRules, newRule]
    : existingRules.filter((rule) => !isManagedRateLimitRule(rule))

  // Nếu entrypoint chưa có id (auto-create fallback empty) và ta vẫn muốn enable
  // → POST tạo ruleset mới với rule lõn sẵn.
  if (!entrypoint.id && input.enabled) {
    await cfFetch<CloudflareRuleset>(`/zones/${input.zoneId}/rulesets`, input, {
      method: "POST",
      data: { name: "default", description: "Managed rate-limit ruleset", kind: "zone", phase: "http_ratelimit", rules },
    })
    console.info("Cloudflare rate limit ruleset created", { zoneId: input.zoneId })
    return { status: "enabled" }
  }

  // Có entrypoint id → PUT update list rule
  await cfFetch<CloudflareRuleset>(`/zones/${input.zoneId}/rulesets/${entrypoint.id}`, input, {
    method: "PUT",
    data: { id: entrypoint.id, name: entrypoint.name || "default", kind: "zone", phase: "http_ratelimit", rules },
  })
  console.info(input.enabled ? "Cloudflare rate limit enabled" : "Cloudflare rate limit disabled", { zoneId: input.zoneId, rulesetId: entrypoint.id })
  return { status: input.enabled ? "enabled" : "disabled" }
}
