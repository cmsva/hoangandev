/**
 * Captcha — Hỗ trợ 3 provider: reCAPTCHA v2, Cloudflare Turnstile, hCaptcha.
 *
 * Config từ DB (settings):
 *   - captcha_provider: "none" | "recaptcha_v2" | "turnstile" | "hcaptcha"
 *   - captcha_site_key: public key (client)
 *   - captcha_secret_key: server-side verify key
 *   - captcha_functions: comma-separated list (register,login,forgot_password,create_ticket,verify_2fa)
 *
 * Server-side: gọi `verifyCaptcha(token, action)` trong tRPC.
 * Client-side: dùng <CaptchaWidget /> component.
 */
import { connectDB } from "@/lib/db"
import { getSiteOptions, Setting } from "@/models/setting.model"
import { cached, invalidate } from "@/lib/cache"

export type CaptchaProvider = "none" | "recaptcha_v2" | "turnstile" | "hcaptcha"
export type CaptchaFunction = "register" | "login" | "forgot_password" | "create_ticket" | "verify_2fa"

export interface CaptchaConfig {
  provider: CaptchaProvider
  siteKey: string
  secretKey: string
  functions: CaptchaFunction[]
}

// No in-memory cache — luuôn fresh từ DB. Khi cần cache, bọc qua Redis ngoài.

const KEYS = [
  "captcha_provider",
  "captcha_site_key",
  "captcha_secret_key",
  "captcha_functions",
]

const DEFAULTS: CaptchaConfig = {
  provider: "none",
  siteKey: "",
  secretKey: "",
  functions: [],
}

async function loadCaptchaFromDB(): Promise<CaptchaConfig> {
  try {
    await connectDB()
    const opts = await getSiteOptions(KEYS)
    const provider = (opts.captcha_provider || "none") as CaptchaProvider
    return {
      provider: ["none", "recaptcha_v2", "turnstile", "hcaptcha"].includes(provider) ? provider : "none",
      siteKey: opts.captcha_site_key || "",
      secretKey: opts.captcha_secret_key || "",
      functions: (opts.captcha_functions || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as CaptchaFunction[],
    }
  } catch {
    return DEFAULTS
  }
}

/** Lấy captcha config — Redis cache 30s, fallback DB. */
export async function getCaptchaConfig(): Promise<CaptchaConfig> {
  return await cached("captcha:config", 30, loadCaptchaFromDB)
}

/** Public config (không lộ secret) — gửi xuống client. */
export async function getPublicCaptchaConfig() {
  const c = await getCaptchaConfig()
  return {
    provider: c.provider,
    siteKey: c.siteKey,
    functions: c.functions,
  }
}

/** Save captcha config + invalidate. */
export async function saveCaptchaConfig(config: CaptchaConfig): Promise<void> {
  await connectDB()
  const entries: Array<{ key: string; value: string }> = [
    { key: "captcha_provider", value: config.provider },
    { key: "captcha_site_key", value: config.siteKey },
    { key: "captcha_secret_key", value: config.secretKey },
    { key: "captcha_functions", value: config.functions.join(",") },
  ]

  await Promise.all(
    entries.map((e) =>
      Setting.updateOne({ key: e.key }, { $set: { value: e.value } }, { upsert: true })
    )
  )
  void invalidate("captcha:config")
}

export function invalidateCaptchaCache(): void {
  void invalidate("captcha:config")
}

// ─── Server-side verify ────────────────────────────────────────────────────

/**
 * Verify captcha token với provider tương ứng.
 * Chỉ verify nếu provider != "none" VÀ action ∈ functions.
 *
 * @param token  Token từ client widget
 * @param action Action name (login, register, ...)
 * @param remoteIp  Optional client IP (cho recaptcha verify)
 * @returns true nếu pass hoặc không cần verify; false nếu fail
 */
export async function verifyCaptcha(
  token: string | null | undefined,
  action: CaptchaFunction,
  remoteIp?: string
): Promise<boolean> {
  const cfg = await getCaptchaConfig()
  if (cfg.provider === "none" || !cfg.functions.includes(action)) {
    return true // không cần verify
  }

  if (!token) return false
  if (!cfg.secretKey) return false

  try {
    if (cfg.provider === "recaptcha_v2") {
      const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: cfg.secretKey,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }).toString(),
        signal: AbortSignal.timeout(8_000),
      })
      const data = await res.json()
      return Boolean(data?.success)
    }

    if (cfg.provider === "turnstile") {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: cfg.secretKey,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }).toString(),
        signal: AbortSignal.timeout(8_000),
      })
      const data = await res.json()
      return Boolean(data?.success)
    }

    if (cfg.provider === "hcaptcha") {
      const res = await fetch("https://api.hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: cfg.secretKey,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }).toString(),
        signal: AbortSignal.timeout(8_000),
      })
      const data = await res.json()
      return Boolean(data?.success)
    }
  } catch {
    return false
  }

  return false
}
