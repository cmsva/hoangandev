/**
 * Site Notification Service — Layer 2 cho thông báo công khai trên dashboard.
 *
 * Tách rõ 2 loại:
 *  - banners: nhiều ô alert nhiều màu hiển thị dưới breadcrumb dashboard.
 *             Mỗi banner = HTML soạn bằng CKEditor (sanitize server-side).
 *  - popup  : dialog trang dashboard, content HTML CKEditor, 2 button
 *             đóng / ẩn 1 giờ (snooze).
 *
 * Storage (key-value `settings`):
 *  - homepage_banners_enabled : "0" | "1" (master toggle bật/tắt toàn bộ)
 *  - site_banners              : JSON.stringify(BannerItem[])
 *  - floating_popup_enabled    : "0" | "1"
 *  - floating_popup_html       : HTML CKEditor (đã sanitize)
 *
 * Backward-compatible: nếu chưa có `site_banners` mà có config cũ
 * (homepage_banner_title/content/...) → tự build 1 item từ data cũ.
 *
 * Cache Redis 10s, invalidate khi save. Protocol-agnostic.
 */
import { connectDB } from "@/lib/db"
import { getSiteOptions, setSiteOptions } from "@/models/setting.model"
import { cached, invalidate } from "@/lib/cache"
import { sanitizeRichHtml } from "@/lib/sanitize"

// ─── Constants ──────────────────────────────────────────────────────────────

export const BANNER_VARIANTS = ["info", "success", "warning", "promo", "danger"] as const
export type BannerVariant = (typeof BANNER_VARIANTS)[number]

export const MAX_BANNERS = 5
export const MAX_BANNER_HTML_LENGTH = 20_000
export const MAX_POPUP_HTML_LENGTH = 20_000

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BannerItem {
  /** UUID-like id (admin tạo hoặc tự sinh). Dùng cho dismiss tracking client. */
  id: string
  enabled: boolean
  variant: BannerVariant
  contentHtml: string
}

export interface FloatingPopupConfig {
  enabled: boolean
  contentHtml: string
}

export interface SiteNotifications {
  bannersEnabled: boolean
  banners: BannerItem[]
  popup: FloatingPopupConfig
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeVariant(raw: string | undefined | null): BannerVariant {
  return (BANNER_VARIANTS as readonly string[]).includes(raw || "")
    ? (raw as BannerVariant)
    : "info"
}

/** Sinh id 12-char base36 — đủ unique cho banner UI tracking. */
function generateBannerId(): string {
  return `bn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Parse JSON banners array an toàn. Reject nếu shape sai. Trả [] khi lỗi.
 */
function parseBanners(raw: string | undefined): BannerItem[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .slice(0, MAX_BANNERS)
      .map((item: unknown) => {
        if (!item || typeof item !== "object") return null
        const it = item as Record<string, unknown>
        const id = typeof it.id === "string" && it.id ? it.id : generateBannerId()
        const enabled = it.enabled !== false
        const variant = normalizeVariant(typeof it.variant === "string" ? it.variant : "info")
        const contentHtml = typeof it.contentHtml === "string" ? it.contentHtml : ""
        return { id, enabled, variant, contentHtml }
      })
      .filter(Boolean) as BannerItem[]
  } catch {
    return []
  }
}

/**
 * Migrate data cũ (homepage_banner_*) → 1 banner item HTML.
 * Chỉ chạy khi `site_banners` chưa có dữ liệu.
 */
function migrateLegacyBanner(opts: Record<string, string | undefined>): BannerItem[] {
  const title = opts.homepage_banner_title?.trim() || ""
  const content = opts.homepage_banner_content?.trim() || ""
  if (!title && !content) return []
  const link = opts.homepage_banner_link?.trim() || ""
  const variant = normalizeVariant(opts.homepage_banner_variant)
  const titleHtml = title ? `<p><strong>${escapeHtml(title)}</strong></p>` : ""
  const contentHtml = content ? `<p>${escapeHtml(content)}</p>` : ""
  const linkHtml = link
    ? `<p><a href="${escapeHtml(link)}">Xem ngay</a></p>`
    : ""
  return [
    {
      id: generateBannerId(),
      enabled: opts.homepage_banner_enabled === "1",
      variant,
      contentHtml: `${titleHtml}${contentHtml}${linkHtml}`,
    },
  ]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function getSiteNotifications(): Promise<SiteNotifications> {
  await connectDB()
  const opts = await getSiteOptions([
    // New keys
    "homepage_banners_enabled",
    "site_banners",
    "floating_popup_enabled",
    "floating_popup_html",
    // Legacy keys (backward-compat migration)
    "homepage_banner_enabled",
    "homepage_banner_title",
    "homepage_banner_content",
    "homepage_banner_link",
    "homepage_banner_variant",
    "floating_popup_title",
    "floating_popup_content",
  ])

  let banners = parseBanners(opts.site_banners)
  let bannersEnabled = opts.homepage_banners_enabled === "1"

  // Migration: chưa có site_banners mới mà có data cũ → dùng tạm.
  if (banners.length === 0 && !opts.site_banners) {
    banners = migrateLegacyBanner(opts)
    if (opts.homepage_banners_enabled === undefined) {
      bannersEnabled = opts.homepage_banner_enabled === "1"
    }
  }

  // Popup: ưu tiên html mới, fallback build từ title+content cũ.
  let popupHtml = opts.floating_popup_html || ""
  if (!popupHtml && opts.floating_popup_content) {
    const titleEsc = opts.floating_popup_title
      ? `<h3>${escapeHtml(opts.floating_popup_title)}</h3>`
      : ""
    popupHtml = `${titleEsc}<p>${escapeHtml(opts.floating_popup_content)}</p>`
  }

  return {
    bannersEnabled,
    banners,
    popup: {
      enabled: opts.floating_popup_enabled === "1",
      contentHtml: popupHtml,
    },
  }
}

/** Redis cache 10s — landing page + public query gọi mỗi render. */
export async function getCachedSiteNotifications(): Promise<SiteNotifications> {
  return await cached("settings:site-notifications", 10, getSiteNotifications)
}

export function invalidateSiteNotificationsCache(): void {
  void invalidate("settings:site-notifications")
}

// ─── Write ──────────────────────────────────────────────────────────────────

export interface SaveSiteNotificationsInput {
  bannersEnabled: boolean
  banners: BannerItem[]
  popup: FloatingPopupConfig
}

/**
 * Lưu config — sanitize HTML server-side để bảo vệ render bằng
 * dangerouslySetInnerHTML ở client.
 *
 * Banner items được clamp ≤ MAX_BANNERS, content ≤ MAX_BANNER_HTML_LENGTH.
 */
export async function saveSiteNotifications(input: SaveSiteNotificationsInput): Promise<void> {
  await connectDB()

  const safeBanners: BannerItem[] = input.banners.slice(0, MAX_BANNERS).map((b) => ({
    id: typeof b.id === "string" && b.id ? b.id.slice(0, 64) : generateBannerId(),
    enabled: !!b.enabled,
    variant: normalizeVariant(b.variant),
    contentHtml: sanitizeRichHtml(b.contentHtml || "").slice(0, MAX_BANNER_HTML_LENGTH),
  }))

  await setSiteOptions({
    homepage_banners_enabled: input.bannersEnabled ? "1" : "0",
    site_banners: JSON.stringify(safeBanners),
    floating_popup_enabled: input.popup.enabled ? "1" : "0",
    floating_popup_html: sanitizeRichHtml(input.popup.contentHtml || "").slice(
      0,
      MAX_POPUP_HTML_LENGTH
    ),
  })

  invalidateSiteNotificationsCache()
}

// ─── Public helper cho component admin tạo id mới ───────────────────────────
export { generateBannerId }
