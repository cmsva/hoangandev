/**
 * Setup Service — First-time installation wizard logic.
 *
 * Flow:
 *   - `isSetupComplete()`: check xem đã có admin user chưa.
 *     Setup chỉ chạy 1 lần. Sau khi có admin → mọi gọi setup → reject.
 *   - `runSetup(input)`: atomic
 *       1. Validate đầu vào (zod ở router)
 *       2. Save settings (SEO + SMTP + Telegram + Contact)
 *       3. Tạo admin user (admin=1, emailVerified=1)
 *       4. Return {success: true}
 *   - Settings và User collections sẽ auto-create lúc insert/create đầu tiên.
 *     Không cần pre-seed gì cả — UI tự handle empty states.
 */
import { connectDB } from "@/lib/db"
import { User } from "@/models/user.model"
import { setSiteOptions } from "@/models/setting.model"
import { hashPassword } from "@/services/auth.service"
import { invalidateMailConfigCache } from "@/lib/send-mail"
import { invalidateTelegramConfigCache } from "@/lib/send-telegram"
import { invalidateSettingsCache } from "@/services/settings.service"
import { invalidateSecurityConfigCache } from "@/lib/security-config"
import { getRedis } from "@/lib/redis"
import { toPhysicalKey } from "@/lib/redis-namespace"
import { logger } from "@/lib/logger"

export interface SetupInput {
  // Step 1 — SEO
  siteTitle: string
  siteDescription: string
  siteKeywords: string
  siteAuthor: string
  // Step 2 — SMTP (optional)
  smtpEnabled: boolean
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  // Step 2 — Telegram (optional)
  telegramEnabled: boolean
  telegramToken: string
  telegramChatId: string
  // Step 3 — Contact
  adminEmail: string
  adminHotline: string
  adminFanpage: string
  adminZalo: string
  adminTelegram: string
  adminName: string
  // Step 4 — Admin account
  username: string
  fullname: string
  email: string
  password: string
}

const SETUP_FLAG_KEY = "setup:complete"

/**
 * Sticky in-memory flag. Khi đã XÁC NHẬN có user (DB / Redis / vừa runSetup) thì
 * giữ `true` suốt vòng đời process. Trạng thái này KHÔNG bao giờ đảo ngược (setup
 * chỉ chạy 1 lần) → lỗi DB/Redis tạm thời không thể đẩy user về /setup.
 */
let setupCompleteMemo = false

/**
 * `true` nếu DB đã có ít nhất 1 user (bất kỳ) → setup đã chạy xong.
 *
 * Thứ tự kiểm tra (nhanh → chắc chắn):
 *   1. Memo in-memory đã `true` → tin tuyệt đối (không đụng DB/Redis).
 *   2. Redis flag = "1" → true.
 *   3. Query DB: userCount > 0.
 *
 * QUAN TRỌNG — lỗi DB KHÔNG được ép về `false`. Đó chính là bug "setup loop"
 * production: 1 lần query timeout (pool nguội / Redis tắt) → false → redirect
 * /setup dù DB đã có admin. Thay vào đó trả trạng thái đã biết gần nhất (memo).
 */
export async function isSetupComplete(): Promise<boolean> {
  // 1. Sticky memo: đã xác nhận có user → khỏi query lại.
  if (setupCompleteMemo) return true

  const redis = getRedis()

  // 2. Redis fast-path: cờ "đã setup" đã cache.
  if (redis) {
    try {
      const flag = await redis.get(toPhysicalKey(SETUP_FLAG_KEY))
      if (flag === "1") {
        setupCompleteMemo = true
        return true
      }
    } catch {
      // Redis lỗi → bỏ qua, query DB.
    }
  }

  // 3. Query DB (collection rỗng → cực nhanh).
  try {
    await connectDB()
    const userCount = await User.countDocuments({})
    const complete = userCount > 0
    if (complete) {
      setupCompleteMemo = true
      if (redis) redis.set(toPhysicalKey(SETUP_FLAG_KEY), "1", "EX", 86400).catch(() => {})
    }
    logger.info("isSetupComplete check", { module: "setup", userCount, complete, source: "db" })
    return complete
  } catch (err) {
    // Lỗi DB → KHÔNG ép false (tránh setup loop). Trả trạng thái đã biết gần nhất.
    // Lần đầu chưa biết → memo=false (đúng: cho vào setup).
    logger.error("isSetupComplete: DB check failed", err as Error, {
      module: "setup",
      fallbackMemo: setupCompleteMemo,
    })
    return setupCompleteMemo
  }
}

/** Đánh dấu đã-setup ngay sau khi runSetup thành công (set cả memo + Redis). */
function markSetupComplete(): void {
  setupCompleteMemo = true
  const redis = getRedis()
  if (redis) redis.set(toPhysicalKey(SETUP_FLAG_KEY), "1", "EX", 86400).catch(() => {})
}

/**
 * Run first-time setup. Reject nếu DB đã có user (chống re-run).
 */
export async function runSetup(input: SetupInput): Promise<{ userId: string }> {
  await connectDB()

  // Idempotency guard: nếu đã có bất kỳ user nào → từ chối
  const existingUsers = await User.countDocuments({}).limit(1)
  if (existingUsers > 0) {
    throw new Error("SETUP_ALREADY_COMPLETED")
  }

  // ─── 1. Save settings (best-effort — không block tạo admin) ──
  const settingsEntries: Record<string, string> = {
    // SEO
    site_title: input.siteTitle.trim(),
    site_description: input.siteDescription.trim(),
    site_keywords: input.siteKeywords.trim(),
    site_author: input.siteAuthor.trim(),
    // Contact / Admin info
    admin_email: input.adminEmail.trim(),
    admin_hotline: input.adminHotline.trim(),
    admin_fanpage: input.adminFanpage.trim(),
    admin_zalo: input.adminZalo.trim(),
    admin_telegram: input.adminTelegram.trim(),
    admin_name: input.adminName.trim(),
  }

  // SMTP (optional)
  if (input.smtpEnabled && input.smtpHost && input.smtpUser) {
    settingsEntries.smtp_status = "1"
    settingsEntries.smtp_host = input.smtpHost.trim()
    settingsEntries.smtp_port = input.smtpPort.trim() || "587"
    settingsEntries.smtp_secure = input.smtpSecure ? "1" : "0"
    settingsEntries.smtp_user = input.smtpUser.trim()
    settingsEntries.smtp_pass = input.smtpPass
    settingsEntries.smtp_from = input.smtpFrom.trim() || input.smtpUser.trim()
    // Bật mặc định 1 vài notify quan trọng
    settingsEntries.smtp_notify_verify_email = "1"
    settingsEntries.smtp_notify_login = "1"
    settingsEntries.smtp_notify_forgot_password = "1"
    settingsEntries.smtp_notify_change_password = "1"
    settingsEntries.smtp_notify_deposit_success = "1"
    settingsEntries.smtp_notify_order_status = "1"
  } else {
    settingsEntries.smtp_status = "0"
  }

  // Telegram (optional)
  if (input.telegramEnabled && input.telegramToken && input.telegramChatId) {
    settingsEntries.telegram_status = "1"
    settingsEntries.telegram_token = input.telegramToken.trim()
    settingsEntries.telegram_chat_id = input.telegramChatId.trim()
    settingsEntries.telegram_user_status = "0"
  } else {
    settingsEntries.telegram_status = "0"
  }

  await setSiteOptions(settingsEntries)

  // ─── 2. Create admin user ──
  const username = input.username.toLowerCase().trim()
  const email = input.email.toLowerCase().trim()

  // Check trùng (rất hiếm vì DB rỗng, nhưng vẫn check)
  const dup = await User.findOne(
    { $or: [{ username }, { email }] },
    { _id: 1 }
  ).lean()
  if (dup) {
    throw new Error("USERNAME_OR_EMAIL_EXISTS")
  }

  const hashed = await hashPassword(input.password)
  const adminUser = await User.create({
    username,
    fullname: input.fullname.trim(),
    email,
    password: hashed,
    admin: 1,
    emailVerified: 1, // Admin tạo từ setup → trust luôn
  })

  // ─── 3. Invalidate caches → mọi config mới có hiệu lực ngay ──
  invalidateMailConfigCache()
  invalidateTelegramConfigCache()
  invalidateSettingsCache()
  invalidateSecurityConfigCache()
  markSetupComplete()

  return { userId: String(adminUser._id) }
}
