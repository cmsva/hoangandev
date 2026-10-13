/**
 * Security Settings Service — CRUD cho các giá trị security/runtime trong DB.
 * Protocol-agnostic, không phụ thuộc tRPC ctx.
 */
import { randomBytes } from "node:crypto"
import { connectDB } from "@/lib/db"
import {
  getSiteOptions,
  setSiteOptions,
  setSiteOption,
  getSiteOption,
  Setting,
} from "@/models/setting.model"
import {
  invalidateSecurityConfigCache,
  SECURITY_DEFAULTS,
  type SecurityConfig,
} from "@/lib/security-config"
import { resetAuthLimitCache } from "@/lib/auth-rate-limit"

// ─── Read ──────────────────────────────────────────────────────────────────

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
  "reward_email_min",
  "reward_email_max",
  "reward_telegram_min",
  "reward_telegram_max",
  "session_ttl",
]

export interface SecuritySettings {
  // Rate limits
  rateLimitLogin: number
  rateLimitRegister: number
  rateLimitForgot: number
  rateLimitPurchase: number
  rateLimitDeposit: number
  loginBanDuration: number
  // Toggles
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
  // Rewards
  rewardEmailMin: number
  rewardEmailMax: number
  rewardTelegramMin: number
  rewardTelegramMax: number
  // Session TTL (giây)
  sessionTtl: number
  // Cron secret — chỉ trả flag exists để UI hiển thị; value lấy riêng qua getCronSecretMasked
  cronSecretConfigured: boolean
}

function pInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw || "", 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  await connectDB()
  const opts = await getSiteOptions([...KEYS, "cron_secret"])
  return {
    rateLimitLogin: pInt(opts.rate_limit_login, SECURITY_DEFAULTS.rateLimitLogin),
    rateLimitRegister: pInt(opts.rate_limit_register, SECURITY_DEFAULTS.rateLimitRegister),
    rateLimitForgot: pInt(opts.rate_limit_forgot, SECURITY_DEFAULTS.rateLimitForgot),
    rateLimitPurchase: pInt(opts.rate_limit_purchase, SECURITY_DEFAULTS.rateLimitPurchase),
    rateLimitDeposit: pInt(opts.rate_limit_deposit, SECURITY_DEFAULTS.rateLimitDeposit),
    loginBanDuration: pInt(opts.login_ban_duration, SECURITY_DEFAULTS.loginBanDuration),
    registerEnabled: opts.register_enabled !== "0",
    maintenanceMode: opts.maintenance_mode === "1",
    maxPendingInvoices: pInt(opts.max_pending_invoices, SECURITY_DEFAULTS.maxPendingInvoices),
    apiKeyMaxAttempts: pInt(opts.api_key_max_attempts, SECURITY_DEFAULTS.apiKeyMaxAttempts),
    securityCsp: opts.security_csp || "",
    securityHsts: opts.security_hsts !== "0",
    securityXFrame: opts.security_x_frame || SECURITY_DEFAULTS.securityXFrame,
    securityReferrer: opts.security_referrer || SECURITY_DEFAULTS.securityReferrer,
    rewardEmailMin: pInt(opts.reward_email_min, SECURITY_DEFAULTS.rewardEmailMin),
    rewardEmailMax: pInt(opts.reward_email_max, SECURITY_DEFAULTS.rewardEmailMax),
    rewardTelegramMin: pInt(opts.reward_telegram_min, SECURITY_DEFAULTS.rewardTelegramMin),
    rewardTelegramMax: pInt(opts.reward_telegram_max, SECURITY_DEFAULTS.rewardTelegramMax),
    sessionTtl: pInt(opts.session_ttl, SECURITY_DEFAULTS.sessionTtl),
    cronSecretConfigured: Boolean((opts.cron_secret || "").length >= 8),
  }
}

// ─── Write ─────────────────────────────────────────────────────────────────

export interface SaveSecuritySettingsInput {
  rateLimitLogin: number
  rateLimitRegister: number
  rateLimitForgot: number
  rateLimitPurchase: number
  rateLimitDeposit: number
  loginBanDuration: number
  registerEnabled: boolean
  maintenanceMode: boolean
  maxPendingInvoices: number
  apiKeyMaxAttempts: number
  securityCsp: string
  securityHsts: boolean
  securityXFrame: string
  securityReferrer: string
  rewardEmailMin: number
  rewardEmailMax: number
  rewardTelegramMin: number
  rewardTelegramMax: number
  sessionTtl: number
}

export async function saveSecuritySettings(input: SaveSecuritySettingsInput): Promise<void> {
  await connectDB()

  // Clamp + cross-validate trước khi ghi để DB luôn nhất quán
  const sessionTtl = Math.max(60, Math.min(31_536_000, Math.floor(input.sessionTtl || SECURITY_DEFAULTS.sessionTtl)))
  const emailMin = Math.max(0, input.rewardEmailMin | 0)
  const emailMax = Math.max(emailMin, input.rewardEmailMax | 0)
  const tgMin = Math.max(0, input.rewardTelegramMin | 0)
  const tgMax = Math.max(tgMin, input.rewardTelegramMax | 0)

  await setSiteOptions({
    rate_limit_login: String(Math.max(1, input.rateLimitLogin | 0)),
    rate_limit_register: String(Math.max(1, input.rateLimitRegister | 0)),
    rate_limit_forgot: String(Math.max(1, input.rateLimitForgot | 0)),
    rate_limit_purchase: String(Math.max(0, input.rateLimitPurchase | 0)),
    rate_limit_deposit: String(Math.max(0, input.rateLimitDeposit | 0)),
    login_ban_duration: String(Math.max(1000, input.loginBanDuration | 0)),
    register_enabled: input.registerEnabled ? "1" : "0",
    maintenance_mode: input.maintenanceMode ? "1" : "0",
    max_pending_invoices: String(Math.max(1, input.maxPendingInvoices | 0)),
    api_key_max_attempts: String(Math.max(1, input.apiKeyMaxAttempts | 0)),
    security_csp: input.securityCsp || "",
    security_hsts: input.securityHsts ? "1" : "0",
    security_x_frame: input.securityXFrame || SECURITY_DEFAULTS.securityXFrame,
    security_referrer: input.securityReferrer || SECURITY_DEFAULTS.securityReferrer,
    reward_email_min: String(emailMin),
    reward_email_max: String(emailMax),
    reward_telegram_min: String(tgMin),
    reward_telegram_max: String(tgMax),
    session_ttl: String(sessionTtl),
  })

  invalidateSecurityConfigCache()
  resetAuthLimitCache()
}

// ─── Cron Secret ───────────────────────────────────────────────────────────

/** Trả secret đã mask (•••• + 4 ký tự cuối) cho UI. Source of truth là DB. */
export async function getCronSecretMasked(): Promise<{ configured: boolean; masked: string; source: "db" | "env" | "none" }> {
  await connectDB()
  const dbVal = (await getSiteOption("cron_secret")) || ""
  if (dbVal.length >= 8) {
    return {
      configured: true,
      masked: maskSecret(dbVal),
      source: "db",
    }
  }
  const envVal = process.env.CRON_SECRET || ""
  if (envVal.length >= 8) {
    return {
      configured: true,
      masked: maskSecret(envVal),
      source: "env",
    }
  }
  return { configured: false, masked: "", source: "none" }
}

/** Trả secret thô — chỉ admin mới được gọi. */
export async function getCronSecretRaw(): Promise<string> {
  await connectDB()
  const dbVal = (await getSiteOption("cron_secret")) || ""
  if (dbVal) return dbVal
  return process.env.CRON_SECRET || ""
}

export async function saveCronSecret(value: string): Promise<void> {
  await connectDB()
  const v = value.trim()
  if (!v) {
    // Empty → xoá khỏi DB, fallback về env
    await Setting.deleteOne({ key: "cron_secret" })
    return
  }
  if (v.length < 8) {
    throw new Error("Cron secret phải có ít nhất 8 ký tự")
  }
  await setSiteOption("cron_secret", v)
}

export async function clearCronSecret(): Promise<void> {
  await connectDB()
  await Setting.deleteOne({ key: "cron_secret" })
}

export function generateCronSecret(): string {
  return randomBytes(24).toString("hex")
}

function maskSecret(value: string): string {
  if (value.length <= 4) return "•".repeat(value.length)
  return "•".repeat(Math.max(8, value.length - 4)) + value.slice(-4)
}

// ─── Convert SecurityConfig → SecuritySettings (cho UI khi load từ cache) ──
export function configToSettings(c: SecurityConfig, cronConfigured: boolean): SecuritySettings {
  return {
    rateLimitLogin: c.rateLimitLogin,
    rateLimitRegister: c.rateLimitRegister,
    rateLimitForgot: c.rateLimitForgot,
    rateLimitPurchase: c.rateLimitPurchase,
    rateLimitDeposit: c.rateLimitDeposit,
    loginBanDuration: c.loginBanDuration,
    registerEnabled: c.registerEnabled,
    maintenanceMode: c.maintenanceMode,
    maxPendingInvoices: c.maxPendingInvoices,
    apiKeyMaxAttempts: c.apiKeyMaxAttempts,
    securityCsp: c.securityCsp,
    securityHsts: c.securityHsts,
    securityXFrame: c.securityXFrame,
    securityReferrer: c.securityReferrer,
    rewardEmailMin: c.rewardEmailMin,
    rewardEmailMax: c.rewardEmailMax,
    rewardTelegramMin: c.rewardTelegramMin,
    rewardTelegramMax: c.rewardTelegramMax,
    sessionTtl: c.sessionTtl,
    cronSecretConfigured: cronConfigured,
  }
}
