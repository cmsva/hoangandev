/**
 * SEO Config — catalog các page code cứng + resolver đọc override từ DB (cache 60s).
 *
 * Mỗi public page có 1 `key`. Admin cấu hình title/description/keywords/ogImage theo key
 * ở /adminPanel/seo. `getPageSeo(key)` merge override DB lên default → trả Next Metadata.
 *
 * Gọi `invalidatePageSeoCache()` sau khi admin lưu để pick-up ngay.
 */
import type { Metadata } from "next"
import { connectDB } from "@/lib/db"
import { PageSeo } from "@/models/page-seo.model"
import { cached, invalidate } from "@/lib/cache"

export interface SeoCatalogEntry {
  key: string
  label: string // tên hiển thị ở admin
  path: string // route public
  group: string // nhóm hiển thị ở admin UI
  defaultTitle: string
  defaultDescription: string
  noIndex?: boolean // true = robots noindex (trang auth)
}

// ─── Catalog: nguồn sự thật cho admin UI + fallback ──────────────────────────
export const PAGE_SEO_CATALOG: SeoCatalogEntry[] = [
  // ── Trang công khai ──
  {
    key: "home",
    label: "Trang chủ",
    path: "/",
    group: "Trang công khai",
    defaultTitle: "Trang chủ",
    defaultDescription: "Nền tảng cung cấp mã nguồn, hosting, tên miền và dịch vụ số uy tín.",
  },
  {
    key: "source-code",
    label: "Mã nguồn",
    path: "/source-code",
    group: "Trang công khai",
    defaultTitle: "Mã nguồn",
    defaultDescription: "Khám phá kho mã nguồn chất lượng cao tại VanKhanh.",
  },
  {
    key: "domain",
    label: "Tên miền",
    path: "/domain",
    group: "Trang công khai",
    defaultTitle: "Đăng ký tên miền",
    defaultDescription: "Đăng ký tên miền .com, .vn, .net và 432+ đuôi miền với giá tốt nhất.",
  },
  {
    key: "cronjob",
    label: "CronJob",
    path: "/cronjob",
    group: "Trang công khai",
    defaultTitle: "Tạo Cronjob",
    defaultDescription: "Tạo cronjob auto chạy URL theo lịch định kỳ — nhiều server, giá tốt.",
  },
  {
    key: "create-website",
    label: "Tạo Website",
    path: "/create-website",
    group: "Trang công khai",
    defaultTitle: "Tạo Website",
    defaultDescription: "Marketplace mẫu website chuyên nghiệp — chọn mẫu, nhập domain, admin setup giao site.",
  },
  {
    key: "create-logo",
    label: "Tạo Logo",
    path: "/create-logo",
    group: "Trang công khai",
    defaultTitle: "Đặt Logo",
    defaultDescription: "Đặt logo theo yêu cầu — designer custom trong 24h, bản quyền 100%.",
  },
  {
    key: "blogs",
    label: "Tin tức / Blog",
    path: "/blogs",
    group: "Trang công khai",
    defaultTitle: "Tin tức",
    defaultDescription: "Bài viết, hướng dẫn và cập nhật mới nhất từ VanKhanh.",
  },
  {
    key: "contact",
    label: "Liên hệ",
    path: "/contact",
    group: "Trang công khai",
    defaultTitle: "Liên hệ",
    defaultDescription: "Thông tin liên hệ và các kênh hỗ trợ khách hàng.",
  },
  {
    key: "document-api",
    label: "Tài liệu API Agency",
    path: "/document-api",
    group: "Trang công khai",
    defaultTitle: "API Documentation — Agency Reseller",
    defaultDescription: "Tích hợp REST API để bán lại website, domain, cronjob, logo và mã nguồn từ hệ thống VanKhanh.",
  },

  // ── Trang xác thực (noindex) ──
  {
    key: "auth-login",
    label: "Đăng nhập",
    path: "/authentication/login",
    group: "Trang xác thực",
    defaultTitle: "Đăng nhập",
    defaultDescription: "Đăng nhập vào tài khoản VanKhanh để quản lý website, domain, và dịch vụ.",
    noIndex: true,
  },
  {
    key: "auth-register",
    label: "Đăng ký",
    path: "/authentication/register",
    group: "Trang xác thực",
    defaultTitle: "Đăng ký",
    defaultDescription: "Tạo tài khoản VanKhanh miễn phí để sử dụng các dịch vụ website, domain, và mã nguồn.",
    noIndex: true,
  },
  {
    key: "auth-forgot-password",
    label: "Quên mật khẩu",
    path: "/authentication/forgot-password",
    group: "Trang xác thực",
    defaultTitle: "Quên mật khẩu",
    defaultDescription: "Khôi phục mật khẩu tài khoản VanKhanh qua email.",
    noIndex: true,
  },
  {
    key: "auth-reset-password",
    label: "Đặt lại mật khẩu",
    path: "/authentication/reset-password",
    group: "Trang xác thực",
    defaultTitle: "Đặt lại mật khẩu",
    defaultDescription: "Tạo mật khẩu mới cho tài khoản VanKhanh.",
    noIndex: true,
  },
]

const CATALOG_MAP = new Map(PAGE_SEO_CATALOG.map((e) => [e.key, e]))

// ─── Cache ───────────────────────────────────────────────────────────────────
interface SeoOverride {
  title: string | null
  description: string | null
  keywords: string[]
  ogImage: string | null
}

// ─── Redis cache (30s) — invalidate khi admin save SEO ─────────────────────

async function loadOverridesRaw(): Promise<Array<[string, SeoOverride]>> {
  const result: Array<[string, SeoOverride]> = []
  try {
    await connectDB()
    const docs = await PageSeo.find({})
      .lean<Array<{ key: string; title: string | null; description: string | null; keywords: string[]; ogImage: string | null }>>()
    for (const d of docs) {
      result.push([d.key, {
        title: d.title,
        description: d.description,
        keywords: d.keywords || [],
        ogImage: d.ogImage,
      }])
    }
  } catch {
    // DB lỗi → trả mảng rỗng, fallback default
  }
  return result
}

async function loadOverrides(): Promise<Map<string, SeoOverride>> {
  const arr = await cached("seo:overrides", 30, loadOverridesRaw)
  return new Map(arr)
}

export function invalidatePageSeoCache(): void {
  void invalidate("seo:overrides")
}

/**
 * Trả Next Metadata cho 1 page key. Merge override DB lên default catalog.
 * Dùng trong generateMetadata của page tương ứng.
 */
export async function getPageSeo(key: string): Promise<Metadata> {
  const entry = CATALOG_MAP.get(key)
  const overrides = await loadOverrides()
  const ov = overrides.get(key)

  const title = ov?.title?.trim() || entry?.defaultTitle || key
  const description = ov?.description?.trim() || entry?.defaultDescription || ""
  const keywords = ov?.keywords && ov.keywords.length > 0 ? ov.keywords : undefined
  const ogImage = ov?.ogImage?.trim() || undefined

  const meta: Metadata = {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  }

  // Trang auth → noindex (không cho crawler index)
  if (entry?.noIndex) {
    meta.robots = { index: false, follow: false }
  }

  return meta
}
