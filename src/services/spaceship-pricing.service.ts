/**
 * Spaceship pricing service — đồng bộ TLD + giá từ pricing API nội bộ của Spaceship.
 *
 * Endpoint (đã verify gọi được từ server, không cần auth/cookie):
 *   POST https://www.spaceship.com/gateway/api/v1/pricing-bff/price/getPrices
 *
 * Trả về giá bán lẻ USD cho mỗi TLD (purchase + renewal). Service quy đổi sang VND
 * theo tỉ giá admin nhập, cộng markup → giá bán, rồi upsert vào DomainTld.
 *
 * Protocol-agnostic: không phụ thuộc tRPC ctx. Router gọi connectDB() trước.
 */
import { TRPCError } from "@trpc/server"
import { DomainProviderConfig, DomainTld } from "@/models/domain.model"
import { invalidateTldCache } from "@/lib/tld-cache"
import { logger } from "@/lib/logger"

// ─── Constants ──────────────────────────────────────────────────────────────
const GETPRICES_URL =
  "https://www.spaceship.com/gateway/api/v1/pricing-bff/price/getPrices"
const FETCH_TIMEOUT_MS = 30_000
const BATCH_SIZE = 40 // số slug mỗi request, tránh payload quá lớn
const SAMPLE_SLD = "example" // sld mẫu — giá TLD không phụ thuộc sld (đã verify)

/** Danh sách TLD slug mặc định khi admin chưa cấu hình syncSlugs. */
export const DEFAULT_SYNC_SLUGS = [
  "com", "net", "org", "info", "biz", "io", "co", "xyz", "online", "site",
  "store", "shop", "tech", "dev", "app", "cloud", "pro", "vip", "club", "live",
  "asia", "me", "tv", "cc", "top", "icu", "fun", "space", "website", "digital",
]

// ─── Types ──────────────────────────────────────────────────────────────────
export interface SpaceshipTldPrice {
  /** slug gốc của Spaceship (vd "com", "in_net") */
  slug: string
  /** TLD thực tế (vd "com", "in.net") — dùng làm key DomainTld.tld */
  tld: string
  /** Giá đăng ký năm đầu (regularPrice, USD) */
  purchaseUsd: number | null
  /** Giá gia hạn (regularPrice, USD) */
  renewUsd: number | null
}

export interface MappedTldPrice {
  priceCost: number
  renewCost: number
  priceSold: number
  renewSold: number
}

export interface SyncResult {
  requested: number
  inserted: number
  updated: number
  failed: number
  skipped: number
  errors: string[]
}

// ─── Helpers (pure) ─────────────────────────────────────────────────────────

/** slug Spaceship → TLD thực tế. Multi-part dùng "_" thay "." (vd in_net → in.net). */
export function slugToTld(slug: string): string {
  return slug.trim().toLowerCase().replace(/_/g, ".")
}

/** Parse số tiền dạng "9.49" → 9.49. Trả null nếu không hợp lệ. */
function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** Làm tròn VND lên bội số 1.000 cho đẹp. */
function roundVnd(value: number): number {
  return Math.ceil(value / 1000) * 1000
}

/**
 * Quy đổi giá USD → VND + áp markup → giá bán. Pure function (dễ unit test).
 *
 * - cost = usd × tỉ giá (làm tròn lên 1.000đ)
 * - sold = cost + markup (fixed cộng thẳng VND, percent cộng theo %)
 */
export function mapPricingToTld(
  usd: { purchaseUsd: number | null; renewUsd: number | null },
  opts: { usdToVndRate: number; markupType: "fixed" | "percent"; markupValue: number }
): MappedTldPrice {
  const rate = opts.usdToVndRate > 0 ? opts.usdToVndRate : 26000
  const mv = Math.max(0, opts.markupValue || 0)

  const toCost = (u: number | null): number =>
    u && u > 0 ? roundVnd(u * rate) : 0

  const applyMarkup = (cost: number): number => {
    if (cost <= 0) return 0
    const sold =
      opts.markupType === "percent" ? cost * (1 + mv / 100) : cost + mv
    return roundVnd(sold)
  }

  const priceCost = toCost(usd.purchaseUsd)
  const renewCost = toCost(usd.renewUsd)
  return {
    priceCost,
    renewCost,
    priceSold: applyMarkup(priceCost),
    renewSold: applyMarkup(renewCost),
  }
}

// ─── Fetcher ────────────────────────────────────────────────────────────────

function buildPayload(slugs: string[]) {
  return {
    currencies: ["USD"],
    products: slugs.map((slug) => ({
      priceTypes: ["purchase", "renewal"],
      product: {
        productSlug: slug,
        plan: {
          pricingPlanParams: { transfer: 0, sld: SAMPLE_SLD },
          pricingPlanSlug: "regular",
          period: "P1Y",
        },
      },
    })),
    includeBasePrice: true,
  }
}

/** Đọc 1 product trong response → SpaceshipTldPrice. */
function extractPrices(product: any): { purchaseUsd: number | null; renewUsd: number | null } {
  let purchaseUsd: number | null = null
  let renewUsd: number | null = null
  const prices = Array.isArray(product?.prices) ? product.prices : []
  for (const p of prices) {
    const amount = parseAmount(p?.total?.USD?.regularPrice?.amount)
    if (p?.priceType === "purchase") purchaseUsd = amount
    else if (p?.priceType === "renewal") renewUsd = amount
  }
  return { purchaseUsd, renewUsd }
}

/**
 * Gọi getPrices cho 1 batch slug. Parse JSON an toàn (Spaceship có thể trả HTML
 * khi bị chặn/đổi endpoint → báo lỗi rõ ràng thay vì crash).
 */
async function fetchBatch(slugs: string[]): Promise<SpaceshipTldPrice[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(GETPRICES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        origin: "https://www.spaceship.com",
        referer: "https://www.spaceship.com/domain-search/",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "z-currency": "USD",
      },
      body: JSON.stringify(buildPayload(slugs)),
    })
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : "network"
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Không kết nối được Spaceship (${reason})`,
    })
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  if (!res.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Spaceship trả lỗi HTTP ${res.status}`,
    })
  }

  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Spaceship trả về dữ liệu không hợp lệ (có thể đã đổi/khóa endpoint)",
    })
  }

  const products = Array.isArray(json?.products) ? json.products : []
  return products.map((p: any): SpaceshipTldPrice => {
    const slug = String(p?.product?.productSlug ?? "")
    const { purchaseUsd, renewUsd } = extractPrices(p)
    return { slug, tld: slugToTld(slug), purchaseUsd, renewUsd }
  })
}

/**
 * Lấy giá cho danh sách slug (tự chia batch). Trả Map theo slug.
 */
export async function fetchSpaceshipPrices(
  slugs: string[]
): Promise<Map<string, SpaceshipTldPrice>> {
  const clean = [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))]
  const out = new Map<string, SpaceshipTldPrice>()

  for (let i = 0; i < clean.length; i += BATCH_SIZE) {
    const batch = clean.slice(i, i + BATCH_SIZE)
    const results = await fetchBatch(batch)
    for (const r of results) {
      if (r.slug) out.set(r.slug, r)
    }
  }
  return out
}

// ─── Sync orchestrator ──────────────────────────────────────────────────────

interface SpaceshipPricingConfig {
  usdToVndRate: number
  markupType: "fixed" | "percent"
  markupValue: number
  syncSlugs: string[]
}

async function getPricingConfig(): Promise<SpaceshipPricingConfig> {
  const config = (await DomainProviderConfig.findOne({ provider: "spaceship" })
    .select("usdToVndRate markupType markupValue syncSlugs status")
    .lean()) as any
  if (!config) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Chưa cấu hình Spaceship. Vui lòng lưu cấu hình trước khi đồng bộ.",
    })
  }
  const syncSlugs: string[] =
    Array.isArray(config.syncSlugs) && config.syncSlugs.length > 0
      ? config.syncSlugs
      : DEFAULT_SYNC_SLUGS
  return {
    usdToVndRate: config.usdToVndRate || 26000,
    markupType: config.markupType === "percent" ? "percent" : "fixed",
    markupValue: config.markupValue || 0,
    syncSlugs,
  }
}

/**
 * Upsert 1 TLD provider=spaceship. Chỉ đụng TLD spaceship — KHÔNG ghi đè TLD manual.
 * Trả "inserted" | "updated" | "skipped".
 */
async function upsertSpaceshipTld(
  price: SpaceshipTldPrice,
  mapped: MappedTldPrice
): Promise<"inserted" | "updated" | "skipped"> {
  // Bỏ qua nếu giá không hợp lệ (TLD không tồn tại ở Spaceship sẽ trả null)
  if (mapped.priceCost <= 0 && mapped.renewCost <= 0) return "skipped"

  const existing = (await DomainTld.findOne({ tld: price.tld })
    .select("_id provider")
    .lean()) as any

  // TLD đã tồn tại nhưng là manual → KHÔNG ghi đè (tránh phá giá admin set tay)
  if (existing && existing.provider !== "spaceship") return "skipped"

  if (existing) {
    await DomainTld.updateOne(
      { _id: existing._id },
      {
        $set: {
          priceCost: mapped.priceCost,
          renewCost: mapped.renewCost,
          priceSold: mapped.priceSold,
          renewSold: mapped.renewSold,
          provider: "spaceship",
          providerTld: price.slug,
        },
      }
    )
    return "updated"
  }

  await DomainTld.create({
    tld: price.tld,
    priceCost: mapped.priceCost,
    renewCost: mapped.renewCost,
    priceSold: mapped.priceSold,
    renewSold: mapped.renewSold,
    provider: "spaceship",
    providerTld: price.slug,
    autoRegisterEnabled: false, // admin tự bật sau khi review giá
    autoRenewEnabled: false,
    isActive: true,
  })
  return "inserted"
}

/**
 * Đồng bộ toàn bộ TLD trong syncSlugs: fetch giá → map → upsert.
 * Best-effort: 1 TLD lỗi không làm hỏng cả batch.
 */
export async function syncSpaceshipTlds(): Promise<SyncResult> {
  const config = await getPricingConfig()
  const priceMap = await fetchSpaceshipPrices(config.syncSlugs)

  const result: SyncResult = {
    requested: config.syncSlugs.length,
    inserted: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  for (const slug of config.syncSlugs) {
    const price = priceMap.get(slug.trim().toLowerCase())
    if (!price) {
      result.skipped += 1
      continue
    }
    try {
      const mapped = mapPricingToTld(price, {
        usdToVndRate: config.usdToVndRate,
        markupType: config.markupType,
        markupValue: config.markupValue,
      })
      const action = await upsertSpaceshipTld(price, mapped)
      if (action === "inserted") result.inserted += 1
      else if (action === "updated") result.updated += 1
      else result.skipped += 1
    } catch (err) {
      result.failed += 1
      if (result.errors.length < 10) {
        result.errors.push(`${price.tld}: ${err instanceof Error ? err.message : "lỗi"}`)
      }
      logger.warn("syncSpaceshipTld: 1 TLD lỗi", {
        module: "spaceshipPricing.sync",
        tld: price.tld,
        error: err instanceof Error ? err.message : "Unknown",
      })
    }
  }

  if (result.inserted > 0 || result.updated > 0) {
    invalidateTldCache()
  }
  return result
}
