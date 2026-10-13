/**
 * Security Config — đọc settings từ DB, cache Redis 5s với pub/sub invalidate.
 * Save settings → cache xoá ngay. DB lỗi → fallback DEFAULTS, không block app.
 */
import { connectDB } from "@/lib/db"
import { getSiteOptions } from "@/models/setting.model"
import { cached, invalidate } from "@/lib/cache"

export interface SecurityConfig {
  // Rate limits
  rateLimitLogin: number          // số lần login sai tối đa / IP / 15 phút
  rateLimitRegister: number       // số lần register / IP / 1 giờ
  rateLimitForgot: number         // số lần forgot / IP / 15 phút
  rateLimitPurchase: number       // ms throttle giữa 2 lần purchase
  rateLimitDeposit: number        // ms throttle giữa 2 lần deposit
  loginBanDuration: number        // ms ban sau khi vượt limit login
  // App toggles
  registerEnabled: boolean
  maintenanceMode: boolean
  // Limits
  maxPendingInvoices: number
  apiKeyMaxAttempts: number
  // Headers
  securityCsp: string
  securityHsts: boolean
  securityXFrame: string
  securityReferrer: string
  // Announcement
  announcementEnabled: boolean
  announcementTitle: string
  announcementContent: string
  // Rewards (ngẫu nhiên min..max khi xác minh email / link telegram)
  rewardEmailMin: number
  rewardEmailMax: number
  rewardTelegramMin: number
  rewardTelegramMax: number
  // Session TTL — JWT + cookie maxAge tính bằng giây
  sessionTtl: number
}

const DEFAULTS: SecurityConfig = {
  rateLimitLogin: 5,
  rateLimitRegister: 3,
  rateLimitForgot: 3,
  rateLimitPurchase: 5000,
  rateLimitDeposit: 10000,
  loginBanDuration: 900_000, // 15 min
  registerEnabled: true,
  maintenanceMode: false,
  maxPendingInvoices: 1,
  apiKeyMaxAttempts: 10,
  securityCsp: "",
  securityHsts: true,
  securityXFrame: "SAMEORIGIN",
  securityReferrer: "strict-origin-when-cross-origin",
  announcementEnabled: false,
  announcementTitle: "Thông báo",
  announcementContent: "",
  rewardEmailMin: 10,
  rewardEmailMax: 5000,
  rewardTelegramMin: 10,
  rewardTelegramMax: 5000,
  sessionTtl: 7 * 24 * 60 * 60, // 7 days
}

const KEYS = [
  "rate_limit_login",
  "rate_limit_register",
  "rate_limit_forgot",
  "rate_limit_purchase",
  "rate_limit_deposit",
  "login_ban_duration",
  "register_enabled",
  "maintenance_mode",
  "max_pending_invoices",
  "api_key_max_attempts",
  "security_csp",
  "security_hsts",
  "security_x_frame",
  "security_referrer",
  "announcement_enabled",
  "announcement_title",
  "announcement_content",
  "reward_email_min",
  "reward_email_max",
  "reward_telegram_min",
  "reward_telegram_max",
  "session_ttl",
]

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw || "", 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

async function loadFromDB(): Promise<SecurityConfig> {
  try {
    await connectDB()
    const opts = await getSiteOptions(KEYS)
    return {
      rateLimitLogin: parsePositiveInt(opts.rate_limit_login, DEFAULTS.rateLimitLogin),
      rateLimitRegister: parsePositiveInt(opts.rate_limit_register, DEFAULTS.rateLimitRegister),
      rateLimitForgot: parsePositiveInt(opts.rate_limit_forgot, DEFAULTS.rateLimitForgot),
      rateLimitPurchase: parsePositiveInt(opts.rate_limit_purchase, DEFAULTS.rateLimitPurchase),
      rateLimitDeposit: parsePositiveInt(opts.rate_limit_deposit, DEFAULTS.rateLimitDeposit),
      loginBanDuration: parsePositiveInt(opts.login_ban_duration, DEFAULTS.loginBanDuration),
      registerEnabled: opts.register_enabled !== "0",
      maintenanceMode: opts.maintenance_mode === "1",
      maxPendingInvoices: parsePositiveInt(opts.max_pending_invoices, DEFAULTS.maxPendingInvoices),
      apiKeyMaxAttempts: parsePositiveInt(opts.api_key_max_attempts, DEFAULTS.apiKeyMaxAttempts),
      securityCsp: opts.security_csp || DEFAULTS.securityCsp,
      securityHsts: opts.security_hsts !== "0",
      securityXFrame: opts.security_x_frame || DEFAULTS.securityXFrame,
      securityReferrer: opts.security_referrer || DEFAULTS.securityReferrer,
      announcementEnabled: opts.announcement_enabled === "1",
      announcementTitle: opts.announcement_title || DEFAULTS.announcementTitle,
      announcementContent: opts.announcement_content || DEFAULTS.announcementContent,
      rewardEmailMin: parsePositiveInt(opts.reward_email_min, DEFAULTS.rewardEmailMin),
      rewardEmailMax: parsePositiveInt(opts.reward_email_max, DEFAULTS.rewardEmailMax),
      rewardTelegramMin: parsePositiveInt(opts.reward_telegram_min, DEFAULTS.rewardTelegramMin),
      rewardTelegramMax: parsePositiveInt(opts.reward_telegram_max, DEFAULTS.rewardTelegramMax),
      sessionTtl: clampSessionTtl(parsePositiveInt(opts.session_ttl, DEFAULTS.sessionTtl)),
    }
  } catch {
    return DEFAULTS
  }
}

/** Min 60s, Max 365d */
function clampSessionTtl(n: number): number {
  if (n < 60) return DEFAULTS.sessionTtl
  if (n > 31_536_000) return 31_536_000
  return n
}

/** Lấy config — Redis cache 5s, fallback DB. Save settings sẽ invalidate ngay. */
export async function getSecurityConfig(): Promise<SecurityConfig> {
  return await cached("security:config", 5, loadFromDB)
}

/** Force reload — gọi sau khi admin save settings. */
export function invalidateSecurityConfigCache(): void {
  void invalidate("security:config")
}

export const SECURITY_DEFAULTS = DEFAULTS
