/**
 * Context builder — đọc DB tạo markdown read-only cho AI tư vấn.
 *
 * AI chỉ thấy dữ liệu PUBLIC (đã hiện trên website cho mọi visitor):
 *   - Service templates (thuê website)
 *   - TLD domain + giá
 *   - Product (mã nguồn bán sẵn)
 *   - Logo categories
 *   - ServerCronjob (gói cronjob auto-ping)
 *
 * AI KHÔNG thấy: user, order, balance, IP, log, settings, secret, token.
 *
 * Cache 60s qua Redis. Admin update → invalidate.
 */
import { connectDB } from "@/lib/db"
import { Service, ServicePricing } from "@/models/service.model"
import { DomainTld } from "@/models/domain.model"
import { Product } from "@/models/product.model"
import { CategoryLogo } from "@/models/logo.model"
import { ServerCronjob } from "@/models/cronjob.model"
import { cached, invalidate } from "@/lib/cache"

export interface AiContextSnapshot {
  services: Array<{
    name: string
    slug: string
    features: string[]
    pricing: Array<{ months: number; pricePerMonth: number; total: number }>
  }>
  domains: Array<{ tld: string; priceFirst: number; priceRenew: number }>
  products: Array<{ title: string; slug: string; price: number; tags: string[] }>
  logoCategories: Array<{ name: string }>
  cronjobServers: Array<{
    name: string
    pricePerMonth: number
    minIntervalSec: number
    discountPercent: number
    available: boolean
  }>
  generatedAt: number
}

const CACHE_KEY = "ai:context:snapshot"
const CACHE_TTL_SEC = 60

async function loadSnapshotFromDB(): Promise<AiContextSnapshot> {
  await connectDB()

  const [services, allPricings, tlds, products, logoCats, cronServers] = await Promise.all([
    Service.find({ status: 1 })
      .select("serviceName slug featuresList")
      .sort({ stt: 1, salesCount: -1 })
      .limit(40)
      .lean<Array<{ _id: any; serviceName: string; slug: string; featuresList: string[] }>>(),
    ServicePricing.find({})
      .select("serviceId durationMonths pricePerMonth")
      .lean<Array<{ serviceId: any; durationMonths: number; pricePerMonth: number }>>(),
    DomainTld.find({ isActive: true })
      .select("tld priceSold renewSold")
      .sort({ priceSold: 1 })
      .limit(30)
      .lean<Array<{ tld: string; priceSold: number; renewSold: number }>>(),
    Product.find({ status: 1, approved: true })
      .select("title slug price salePrice tags")
      .sort({ salesCount: -1 })
      .limit(30)
      .lean<Array<{ title: string; slug: string; price: number; salePrice: number | null; tags: string[] }>>(),
    CategoryLogo.find({ status: 1 })
      .select("name")
      .limit(20)
      .lean<Array<{ name: string }>>()
      .catch(() => [] as Array<{ name: string }>),
    ServerCronjob.find({ isActive: true })
      .select("name price timeloop discountPercent usageLimit currentUsage")
      .sort({ price: 1 })
      .limit(20)
      .lean<Array<{
        name: string
        price: number
        timeloop: number
        discountPercent: number
        usageLimit: number
        currentUsage: number
      }>>(),
  ])

  const pricingByService = new Map<string, Array<{ months: number; pricePerMonth: number; total: number }>>()
  for (const p of allPricings) {
    const sid = String(p.serviceId)
    const arr = pricingByService.get(sid) ?? []
    arr.push({
      months: p.durationMonths,
      pricePerMonth: p.pricePerMonth,
      total: p.pricePerMonth * p.durationMonths,
    })
    pricingByService.set(sid, arr)
  }
  for (const arr of pricingByService.values()) arr.sort((a, b) => a.months - b.months)

  return {
    services: services.map((s) => ({
      name: s.serviceName,
      slug: s.slug,
      features: (s.featuresList ?? []).slice(0, 6),
      pricing: pricingByService.get(String(s._id)) ?? [],
    })),
    domains: tlds.map((t) => ({
      tld: t.tld,
      priceFirst: t.priceSold,
      priceRenew: t.renewSold,
    })),
    products: products.map((p) => ({
      title: p.title,
      slug: p.slug,
      price: p.salePrice ?? p.price,
      tags: (p.tags ?? []).slice(0, 5),
    })),
    logoCategories: logoCats.map((c) => ({ name: c.name })),
    cronjobServers: cronServers.map((c) => ({
      name: c.name,
      pricePerMonth: c.price,
      minIntervalSec: c.timeloop,
      discountPercent: c.discountPercent || 0,
      available: c.currentUsage < c.usageLimit,
    })),
    generatedAt: Date.now(),
  }
}

export async function getAiContextSnapshot(): Promise<AiContextSnapshot> {
  return await cached(CACHE_KEY, CACHE_TTL_SEC, loadSnapshotFromDB)
}

export function invalidateAiContext(): void {
  void invalidate(CACHE_KEY)
}

/** Format snapshot thành markdown gọn để nhúng vào system prompt. */
export function snapshotToMarkdown(snap: AiContextSnapshot, siteUrl: string): string {
  const fmtVnd = (n: number) =>
    n.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + "đ"

  const out: string[] = []

  // ─── Service templates (thuê website) ───
  if (snap.services.length > 0) {
    out.push("## DỊCH VỤ 1: Thuê website (template) — page `/create-website`")
    out.push(`- Có ${snap.services.length} mẫu đang bán. Mỗi mẫu xem chi tiết tại \`${siteUrl}/[slug]\`.`)
    for (const s of snap.services) {
      const link = `${siteUrl}/${s.slug}`
      const pricing =
        s.pricing.length > 0
          ? s.pricing.map((p) => `${p.months}t=${fmtVnd(p.total)}`).join(" · ")
          : "(liên hệ admin)"
      const features = s.features.length > 0 ? ` | TÍNH NĂNG: ${s.features.slice(0, 4).join(", ")}` : ""
      out.push(`- **${s.name}** [${pricing}]${features} → ${link}`)
    }
    out.push("")
  }

  // ─── Cronjob (auto-ping URL) ───
  if (snap.cronjobServers.length > 0) {
    out.push("## DỊCH VỤ 2: Cronjob (auto-ping URL theo lịch) — page `/cronjob`")
    out.push(
      "- Đây KHÔNG phải hosting. Đây là dịch vụ tự động gửi HTTP request (GET/POST) đến URL của user theo chu kỳ lặp."
    )
    out.push(`- Có ${snap.cronjobServers.length} gói server đang bán, sắp xếp theo giá:`)
    for (const c of snap.cronjobServers) {
      const discount = c.discountPercent > 0 ? ` (giảm ${c.discountPercent}%)` : ""
      const status = c.available ? "" : " — HẾT SLOT"
      out.push(
        `- **${c.name}** — ${fmtVnd(c.pricePerMonth)}/tháng${discount}, vòng lặp tối thiểu ${c.minIntervalSec}s${status}`
      )
    }
    out.push("")
  }

  // ─── Domain ───
  if (snap.domains.length > 0) {
    out.push("## DỊCH VỤ 3: Đăng ký domain — page `/domain`")
    const top = snap.domains.slice(0, 12)
    for (const d of top) {
      out.push(
        `- **.${d.tld}** — đăng ký ${fmtVnd(d.priceFirst)}/năm, gia hạn ${fmtVnd(d.priceRenew)}/năm`
      )
    }
    if (snap.domains.length > top.length) {
      out.push(`- (còn ${snap.domains.length - top.length} TLD khác — xem ${siteUrl}/domain)`)
    }
    out.push("")
  }

  // ─── Source code (Product) ───
  if (snap.products.length > 0) {
    out.push("## DỊCH VỤ 4: Mua mã nguồn (source code bán sẵn) — page `/source-code`")
    for (const p of snap.products.slice(0, 10)) {
      const tags = p.tags.length > 0 ? `[${p.tags.join(", ")}]` : ""
      out.push(`- **${p.title}** ${tags} — ${fmtVnd(p.price)} → ${siteUrl}/source-code/${p.slug}`)
    }
    out.push("")
  }

  // ─── Logo design ───
  if (snap.logoCategories.length > 0) {
    out.push("## DỊCH VỤ 5: Thiết kế Logo theo yêu cầu — page `/create-logo`")
    out.push("- Phân loại: " + snap.logoCategories.map((c) => c.name).join(", "))
    out.push("")
  }

  return out.join("\n").trim()
}
