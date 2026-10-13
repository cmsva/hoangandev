import { logger } from "./logger"

/**
 * Whois lookup via inet.vn — endpoint: /api/whois/domainspecify/{domain}
 * Hỗ trợ CẢ Vietnamese TLD và international TLD.
 *
 * Response shape (verified live):
 *   code: "0" = registered, "1" = available
 *   creationDate_L, expirationDate_L: unix ms
 *   registrar, registrantName: string
 *   nameServer: string[]
 *   status: string[]
 */

const INET_BASE = "https://whois.inet.vn/api/whois/domainspecify"

export type WhoisStatus = "available" | "registered" | "error" | "invalid"

export interface WhoisResult {
  domain: string
  status: WhoisStatus
  source: "inet.vn" | "fallback"
  registrar?: string | null
  registrantName?: string | null
  createdAt?: string | null // ISO string
  expiredAt?: string | null
  nameservers?: string[]
  domainStatus?: string[] // EPP statuses
  rawError?: string
}

/**
 * Fetch with timeout — chống hang.
 */
async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; VanKhanh/1.0)",
        accept: "application/json, text/plain, */*",
        referer: "https://whois.inet.vn/",
        origin: "https://whois.inet.vn",
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

function tsToIso(ms: unknown): string | null {
  const n = typeof ms === "number" ? ms : typeof ms === "string" ? Number(ms) : NaN
  if (!n || Number.isNaN(n)) return null
  try {
    return new Date(n).toISOString()
  } catch {
    return null
  }
}

/**
 * Lookup 1 domain — fail-soft trả status "unknown" thay vì throw.
 */
export async function lookupWhois(domain: string): Promise<WhoisResult> {
  const lower = domain.toLowerCase().trim()
  if (!lower || lower.length > 253 || !lower.includes(".")) {
    return { domain: lower, status: "invalid", source: "fallback" }
  }

  try {
    const res = await fetchWithTimeout(`${INET_BASE}/${encodeURIComponent(lower)}`)

    if (!res.ok) {
      return {
        domain: lower,
        status: "error",
        source: "inet.vn",
        rawError: `HTTP ${res.status}`,
      }
    }

    const data: any = await res.json().catch(() => null)
    if (!data || typeof data !== "object") {
      return { domain: lower, status: "error", source: "inet.vn", rawError: "invalid JSON" }
    }

    const code = String(data.code ?? "")
    const message = typeof data.message === "string" ? data.message : ""

    // Available: code === "1" (không quan tâm message vì intl không có message)
    if (code === "1") {
      return { domain: lower, status: "available", source: "inet.vn" }
    }

    // Registered: STRICT — cả code === "0" và message === "Đã được đăng ký"
    // Mọi trường hợp khác (code lạ, message lạ, missing field) → error
    if (code === "0" && message === "Đã được đăng ký") {
      return {
        domain: lower,
        status: "registered",
        source: "inet.vn",
        registrar: typeof data.registrar === "string" ? data.registrar : null,
        registrantName: typeof data.registrantName === "string" ? data.registrantName : null,
        createdAt: tsToIso(data.creationDate_L) ?? (typeof data.creationDate === "string" ? data.creationDate : null),
        expiredAt: tsToIso(data.expirationDate_L) ?? (typeof data.expirationDate === "string" ? data.expirationDate : null),
        nameservers: Array.isArray(data.nameServer)
          ? data.nameServer.filter((n: any) => typeof n === "string")
          : [],
        domainStatus: Array.isArray(data.status)
          ? data.status.filter((s: any) => typeof s === "string")
          : [],
      }
    }

    // Không khớp pattern nào → báo lỗi
    return {
      domain: lower,
      status: "error",
      source: "inet.vn",
      rawError: `code=${code || "none"} message=${message || "none"}`,
    }
  } catch (err: any) {
    logger.warn("whois lookup failed", {
      module: "whois",
      domain: lower,
      error: err?.message,
    })
    return {
      domain: lower,
      status: "error",
      source: "inet.vn",
      rawError: err?.message ?? String(err),
    }
  }
}

/**
 * Lookup nhiều domain song song — chạy parallel với concurrency limit.
 *
 * @param domains - mảng domain
 * @param concurrency - số request song song tối đa (default 8)
 * @returns Map(domain -> WhoisResult)
 */
export async function lookupWhoisBatch(
  domains: string[],
  concurrency = 8
): Promise<Record<string, WhoisResult>> {
  const unique = Array.from(new Set(domains.map((d) => d.toLowerCase().trim()).filter(Boolean)))
  const result: Record<string, WhoisResult> = {}

  // Chia thành batches theo concurrency để tránh đè API + tránh socket exhaust
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency)
    const settled = await Promise.allSettled(batch.map((d) => lookupWhois(d)))
    settled.forEach((p, idx) => {
      const domain = batch[idx]
      if (p.status === "fulfilled") {
        result[domain] = p.value
      } else {
        result[domain] = {
          domain,
          status: "error",
          source: "inet.vn",
          rawError: p.reason?.message ?? String(p.reason),
        }
      }
    })
  }

  return result
}
