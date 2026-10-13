/**
 * Settings Service — Business logic cho General Settings
 * Protocol-agnostic, không phụ thuộc tRPC ctx.
 */
import { connectDB } from "@/lib/db"
import { getSiteOptions, setSiteOptions, getSiteOption } from "@/models/setting.model"
import { invalidateSecurityConfigCache } from "@/lib/security-config"
import { cached, invalidate } from "@/lib/cache"

// ─── Setting Keys ───────────────────────────────────────────────────────────

export const SETTING_KEYS = {
  // SEO
  site_title: "site_title",
  site_description: "site_description",
  site_keywords: "site_keywords",
  site_author: "site_author",
  admin_email: "admin_email",
  admin_hotline: "admin_hotline",
  admin_fanpage: "admin_fanpage",
  admin_zalo: "admin_zalo",
  admin_telegram: "admin_telegram",
  admin_name: "admin_name",
  // Images
  logo_light: "logo_light",
  logo_dark: "logo_dark",
  favicon: "favicon",
  og_image: "og_image",
  og_description: "og_description",
  // Theme
  theme_color: "theme_color",
  font_family: "font_family",
  font_url: "font_url",
} as const

const ALL_KEYS = Object.values(SETTING_KEYS)

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GeneralSettings {
  // SEO
  siteTitle: string
  siteDomain: string // from env
  siteDescription: string
  siteKeywords: string
  siteAuthor: string
  adminEmail: string
  adminHotline: string
  adminFanpage: string
  adminZalo: string
  adminTelegram: string
  adminName: string
  // Images
  logoLight: string
  logoDark: string
  favicon: string
  ogImage: string
  ogDescription: string
  // Theme
  themeColor: string
  fontFamily: string
  fontUrl: string
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function getGeneralSettings(): Promise<GeneralSettings> {
  await connectDB()
  const opts = await getSiteOptions(ALL_KEYS)
  return {
    siteTitle: opts.site_title || "VanKhanh",
    siteDomain: process.env.NEXT_PUBLIC_APP_URL || "",
    siteDescription: opts.site_description || "",
    siteKeywords: opts.site_keywords || "",
    siteAuthor: opts.site_author || "",
    adminEmail: opts.admin_email || "",
    adminHotline: opts.admin_hotline || "",
    adminFanpage: opts.admin_fanpage || "",
    adminZalo: opts.admin_zalo || "",
    adminTelegram: opts.admin_telegram || "",
    adminName: opts.admin_name || "",
    logoLight: opts.logo_light || "",
    logoDark: opts.logo_dark || "",
    favicon: opts.favicon || "",
    ogImage: opts.og_image || "",
    ogDescription: opts.og_description || "",
    themeColor: opts.theme_color || "",
    fontFamily: opts.font_family || "",
    fontUrl: opts.font_url || "",
  }
}

// ─── Cached general settings ───────────────────────────────────────────────

/**
 * `getCachedGeneralSettings` — Redis cache 10s. Layout RSC + generateMetadata
 * gọi mỗi page render. Save settings sẽ invalidate ngay.
 */
export async function getCachedGeneralSettings(): Promise<GeneralSettings> {
  return await cached("settings:general", 10, getGeneralSettings)
}

export function invalidateSettingsCache(): void {
  void invalidate("settings:general")
}

// ─── Write ──────────────────────────────────────────────────────────────────

export interface SaveGeneralSettingsInput {
  siteTitle: string
  siteDescription: string
  siteKeywords: string
  siteAuthor: string
  adminEmail: string
  adminHotline: string
  adminFanpage: string
  adminZalo: string
  adminTelegram: string
  adminName: string
  logoLight: string
  logoDark: string
  favicon: string
  ogImage: string
  ogDescription: string
  themeColor: string
  fontFamily: string
  fontUrl: string
}

export async function saveGeneralSettings(input: SaveGeneralSettingsInput): Promise<void> {
  await connectDB()
  await setSiteOptions({
    [SETTING_KEYS.site_title]: input.siteTitle,
    [SETTING_KEYS.site_description]: input.siteDescription,
    [SETTING_KEYS.site_keywords]: input.siteKeywords,
    [SETTING_KEYS.site_author]: input.siteAuthor,
    [SETTING_KEYS.admin_email]: input.adminEmail,
    [SETTING_KEYS.admin_hotline]: input.adminHotline,
    [SETTING_KEYS.admin_fanpage]: input.adminFanpage,
    [SETTING_KEYS.admin_zalo]: input.adminZalo,
    [SETTING_KEYS.admin_telegram]: input.adminTelegram,
    [SETTING_KEYS.admin_name]: input.adminName,
    [SETTING_KEYS.logo_light]: input.logoLight,
    [SETTING_KEYS.logo_dark]: input.logoDark,
    [SETTING_KEYS.favicon]: input.favicon,
    [SETTING_KEYS.og_image]: input.ogImage,
    [SETTING_KEYS.og_description]: input.ogDescription,
    [SETTING_KEYS.theme_color]: input.themeColor,
    [SETTING_KEYS.font_family]: input.fontFamily,
    [SETTING_KEYS.font_url]: input.fontUrl,
  })
  // Invalidate security config cache in case related keys changed
  invalidateSecurityConfigCache()
  // Invalidate cached settings so layout/metadata reflect changes immediately
  invalidateSettingsCache()
  invalidateSiteTitleCache()
}

// ─── Site Title (no cache) ─────────────────────────────────────────────────

export async function getSiteTitle(): Promise<string> {
  await connectDB()
  return (await getSiteOption("site_title")) || "VanKhanh"
}

export function invalidateSiteTitleCache(): void {
  // No-op.
}
