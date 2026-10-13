/**
 * Seed services từ dichvuright.click public API.
 *
 * Endpoints:
 *  - List:   https://sv.dichvuright.click/api/services
 *  - Detail: https://sv.dichvuright.click/api/v1/services/{id}
 *
 * Auto-categorize bằng keyword matching trên serviceName.
 *
 * Run: npx tsx scripts/seed-services.ts
 *
 * Idempotent: dùng slug làm khóa, upsert thay vì insert.
 */
import "dotenv/config"
import mongoose from "mongoose"
import { Service, ServicePricing } from "../src/models/service.model"
import { CategoryService } from "../src/models/category-service.model"

const API_BASE = "https://sv.dichvuright.click"
const LIST_API = `${API_BASE}/api/services`
const DETAIL_API = (id: string) => `${API_BASE}/api/v1/services/${id}`

// ─── Categories cấu hình ───────────────────────────────────────────────────
// Auto-detect category dựa vào keyword trong serviceName.
// Order quan trọng: match đầu tiên thắng.
const CATEGORY_RULES: { name: string; slug: string; match: RegExp; stt: number }[] = [
  {
    name: "Web Tăng Tương Tác MXH",
    slug: "web-tang-tuong-tac-mxh",
    match: /tương tác|tuong tac|mạng xã hội|mxh|smm/i,
    stt: 1,
  },
  {
    name: "Web Bán Acc Game",
    slug: "web-ban-acc-game",
    match: /acc game|bán acc|cày thuê|clone via|kim cương|napthe|gạch thẻ|mua thẻ|nạp thẻ|napgame|nạp game|sở cam/i,
    stt: 2,
  },
  {
    name: "Web Tài Nguyên MMO",
    slug: "web-tai-nguyen-mmo",
    match: /mmo|tài nguyên|nguyên liệu|tu \u0111\u1ed9ng|hosting auto|mã nguồn auto/i,
    stt: 3,
  },
  {
    name: "Web Uy Tín / Check Scam",
    slug: "web-uy-tin",
    match: /checkscam|tố cáo|lừa đảo|giao dịch viên|uy tín/i,
    stt: 4,
  },
  {
    name: "Web Khác",
    slug: "web-khac",
    match: /.+/,
    stt: 99,
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180)
}

function decodeBase64(b64: string | null | undefined): string | null {
  if (!b64) return null
  try {
    return Buffer.from(b64.trim(), "base64").toString("utf8")
  } catch {
    return b64
  }
}

function normalizeImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const trimmed = path.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `${API_BASE}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`
}

function detectCategory(serviceName: string): { name: string; slug: string; stt: number } {
  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(serviceName)) {
      return { name: rule.name, slug: rule.slug, stt: rule.stt }
    }
  }
  return { name: "Web Khác", slug: "web-khac", stt: 99 }
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (vankhanh-seed/1.0)",
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return (await res.json()) as T
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface ListItem {
  id: string
  service_name: string
  image: string
  pricing: { id: string; duration_months: string; price_per_month: string }[]
}

interface DetailResponse {
  status: string
  instance: string
  data: {
    id: string
    service_name: string
    image: string
    list_image: string | null
    description: string | null // base64 HTML
    status: string
    pricing: {
      id: string
      duration_months: string
      price_per_month: string
      price_extend_per_month: string
    }[]
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI not set")
    process.exit(1)
  }
  await mongoose.connect(uri)
  console.log("✓ Connected to MongoDB")

  // 1. Fetch list
  console.log("Fetching service list...")
  const services = await fetchJSON<ListItem[]>(LIST_API)
  console.log(`✓ Found ${services.length} services`)

  // 2. Upsert categories first
  const catMap = new Map<string, mongoose.Types.ObjectId>()
  for (const rule of CATEGORY_RULES) {
    const existing = await CategoryService.findOneAndUpdate(
      { slug: rule.slug },
      {
        $set: { name: rule.name, status: 1 },
      },
      { upsert: true, new: true }
    )
    catMap.set(rule.slug, existing._id as any)
    console.log(`  Category: ${rule.name} (${rule.slug})`)
  }

  // 3. Iterate each service → fetch detail → upsert
  let created = 0
  let updated = 0
  let skipped = 0
  let stt = 1

  for (const item of services) {
    try {
      console.log(`\n[${item.id}] ${item.service_name}`)

      // Fetch detail
      const detailRes = await fetchJSON<DetailResponse>(DETAIL_API(item.id))
      if (detailRes.status !== "success") {
        console.warn(`  ⚠ Detail status not success, skipping`)
        skipped++
        continue
      }
      const d = detailRes.data

      // Skip inactive
      if (d.status !== "1") {
        console.warn(`  ⚠ Inactive on source, skipping`)
        skipped++
        continue
      }

      // Detect category
      const cat = detectCategory(d.service_name)
      const categoryId = catMap.get(cat.slug)!

      // Build slug
      const baseSlug = slugify(d.service_name)
      const slug = `${baseSlug}-${item.id}` // suffix id để unique

      // Parse images
      const mainImage = normalizeImageUrl(d.image)
      const listImage = (d.list_image || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map(normalizeImageUrl)
        .filter((x): x is string => !!x)

      // Decode description (base64 HTML)
      const description = decodeBase64(d.description)

      // Upsert service
      const existing = await Service.findOne({ slug })
      const serviceDoc = await Service.findOneAndUpdate(
        { slug },
        {
          $set: {
            serviceName: d.service_name,
            slug,
            categoryId,
            image: mainImage,
            listImage,
            description,
            featuresList: [], // không có trên source, để rỗng
            demoUrl: null, // không có trên source
            adminDemoUrl: null,
            stt: stt++,
            status: 1,
          },
          $setOnInsert: {
            view: 0,
            salesCount: 0,
          },
        },
        { upsert: true, new: true }
      )

      if (existing) {
        updated++
        console.log(`  ↻ Updated`)
      } else {
        created++
        console.log(`  ✓ Created`)
      }

      // Upsert pricing tiers
      // Xóa pricing cũ + insert lại theo data hiện tại (đơn giản hơn upsert từng cái)
      await ServicePricing.deleteMany({ serviceId: serviceDoc._id })
      if (d.pricing && d.pricing.length > 0) {
        await ServicePricing.insertMany(
          d.pricing.map((p) => ({
            serviceId: serviceDoc._id,
            durationMonths: parseInt(p.duration_months, 10),
            pricePerMonth: parseFloat(p.price_per_month),
            priceExtendPerMonth: parseFloat(p.price_extend_per_month || "0"),
          }))
        )
        console.log(
          `  ✓ Pricing: ${d.pricing.length} tier(s) - ${d.pricing.map((p) => `${p.duration_months}m=${parseFloat(p.price_per_month).toLocaleString()}đ`).join(", ")}`
        )
      } else {
        console.warn(`  ⚠ No pricing tiers`)
      }

      // Polite delay để tránh rate-limit
      await new Promise((r) => setTimeout(r, 200))
    } catch (err) {
      console.error(`  ✗ Failed:`, (err as Error).message)
      skipped++
    }
  }

  console.log("\n────────────────────────────────────────")
  console.log(`✓ Created: ${created}`)
  console.log(`↻ Updated: ${updated}`)
  console.log(`⚠ Skipped: ${skipped}`)
  console.log(`Total in DB: ${await Service.countDocuments()}`)
  console.log(`Categories: ${await CategoryService.countDocuments()}`)
  console.log(`Pricings:   ${await ServicePricing.countDocuments()}`)

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
