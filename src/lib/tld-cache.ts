import { DomainTld } from "@/models/domain.model"
import { connectDB } from "./db"
import { cached, invalidate } from "@/lib/cache"

export interface CachedTld {
  id: string
  tld: string
  priceSold: number
  renewSold: number
  isActive: boolean
  // ─── Provider fields (for auto-register/renew resolution) ───
  provider: "manual" | "spaceship"
  autoRegisterEnabled: boolean
  autoRenewEnabled: boolean
}

interface CacheEntry {
  data: CachedTld[]
}

let inflight: Promise<CachedTld[]> | null = null
// Snapshot fail-soft khi DB lỗi.
let lastSnapshot: CacheEntry | null = null

async function loadActiveTldsFromDB(): Promise<CachedTld[]> {
  await connectDB()
  const docs = (await DomainTld.find({ isActive: true })
    .select("tld priceSold renewSold isActive provider autoRegisterEnabled autoRenewEnabled")
    .sort({ priceSold: 1, tld: 1 })
    .lean()) as any[]

  return docs.map((d) => ({
    id: d._id.toString(),
    tld: d.tld,
    priceSold: d.priceSold,
    renewSold: d.renewSold,
    isActive: d.isActive,
    provider: d.provider ?? "manual",
    autoRegisterEnabled: d.autoRegisterEnabled ?? false,
    autoRenewEnabled: d.autoRenewEnabled ?? false,
  }))
}

/**
 * Lấy danh sách TLD active.
 * - Redis cache 60s.
 * - De-dupe inflight chống thundering herd nội tick.
 * - Fail-soft: DB lỗi → snapshot cũ.
 */
export async function getActiveTlds(): Promise<CachedTld[]> {
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const data = await cached("domain:tlds:active", 60, loadActiveTldsFromDB)
      lastSnapshot = { data }
      return data
    } catch (err) {
      if (lastSnapshot) return lastSnapshot.data
      throw err
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/** Invalidate Redis cache khi admin update TLD. */
export function invalidateTldCache(): void {
  void invalidate("domain:tlds:active")
}

/** Map tld string → CachedTld (giúp lookup nhanh trong whois batch). */
export async function getTldByName(tld: string): Promise<CachedTld | null> {
  const lower = tld.toLowerCase().trim()
  const list = await getActiveTlds()
  return list.find((t) => t.tld === lower) ?? null
}
