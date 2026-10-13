/**
 * Profile Link Service — Email verification + Telegram account linking.
 *
 * Storage:
 *   - Email OTP: User.otp + User.otpExpires (we add otpExpires inline as a
 *     side-channel via timeSession, but cleanly via a dedicated field on user)
 *     Implementation note: we encode `<OTP>:<expiresMs>` into User.otp to avoid
 *     touching the schema for the OTP expiry, since `otp` is already a string field.
 *   - Telegram link code: in-memory Map with 10-minute TTL (single Node process).
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { randomInt } from "node:crypto"
import { connectDB } from "@/lib/db"
import { User, type IUser } from "@/models/user.model"
import { getSiteOptions } from "@/models/setting.model"
import { sendMailToUser } from "@/lib/send-mail"
import { sendTelegramUserRaw } from "@/lib/send-telegram"
import { buildTelegramMessage } from "@/lib/telegram-template"

// ─── Email verify ──────────────────────────────────────────────────────────

const EMAIL_OTP_TTL_MS = 5 * 60 * 1000 // 5 phút

function gen6DigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

function encodeOtp(otp: string, expiresAtMs: number): string {
  return `${otp}:${expiresAtMs}`
}

function decodeOtp(stored: string | null | undefined): { otp: string; expiresAtMs: number } | null {
  if (!stored) return null
  const idx = stored.lastIndexOf(":")
  if (idx <= 0) return null
  const otp = stored.slice(0, idx)
  const expiresAtMs = Number(stored.slice(idx + 1))
  if (!Number.isFinite(expiresAtMs)) return null
  return { otp, expiresAtMs }
}

async function findUserOrThrow(userId: Types.ObjectId | string): Promise<IUser> {
  const user = await User.findById(userId)
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Tài khoản không tồn tại" })
  return user
}

/**
 * Phát mã OTP và gửi email cho user.
 * Trả về số giây hiệu lực còn lại (cho UI countdown).
 */
export async function requestEmailVerifyOtp(userId: Types.ObjectId | string) {
  await connectDB()
  const user = await findUserOrThrow(userId)
  if (user.emailVerified === 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Email đã được xác minh" })
  }
  if (!user.email) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tài khoản chưa có email" })
  }

  // Throttle — không cho phát lại trong 60s
  const existing = decodeOtp(user.otp)
  if (existing && existing.expiresAtMs > Date.now() && existing.expiresAtMs - Date.now() > EMAIL_OTP_TTL_MS - 60_000) {
    const waitSec = Math.ceil((existing.expiresAtMs - (Date.now() + EMAIL_OTP_TTL_MS - 60_000)) / 1000)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Vui lòng đợi ${waitSec}s trước khi gửi lại`,
    })
  }

  const otp = gen6DigitOtp()
  const expiresAtMs = Date.now() + EMAIL_OTP_TTL_MS
  await User.updateOne({ _id: user._id }, { $set: { otp: encodeOtp(otp, expiresAtMs) } })

  // Best-effort: send mail. Lỗi không block.
  void sendMailToUser(user.email, "verify_email", {
    username: user.fullname || user.username,
    otp,
  }).catch((err) => console.error("[requestEmailVerifyOtp]", err))

  return {
    success: true,
    expiresIn: Math.ceil(EMAIL_OTP_TTL_MS / 1000),
    message: "Đã gửi mã xác minh tới email",
  }
}

/**
 * Confirm email OTP — set emailVerified = 1 nếu đúng.
 */
export async function confirmEmailVerify(userId: Types.ObjectId | string, code: string) {
  await connectDB()
  const user = await findUserOrThrow(userId)
  if (user.emailVerified === 1) {
    return { success: true, message: "Email đã được xác minh" }
  }

  const decoded = decodeOtp(user.otp)
  if (!decoded || decoded.expiresAtMs < Date.now()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mã đã hết hạn, vui lòng gửi lại" })
  }
  if (decoded.otp !== code) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mã xác minh không đúng" })
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { emailVerified: 1, otp: null } }
  )
  return { success: true, message: "Xác minh email thành công" }
}

// ─── Telegram link ─────────────────────────────────────────────────────────

const TELE_LINK_TTL_MS = 10 * 60 * 1000 // 10 phút
const TELE_CODE_LEN = 8

interface TeleLinkEntry {
  userId: string
  code: string
  createdAt: number
  expiresAt: number
}

/**
 * In-memory link code store. Single Node process: dev/single-server.
 * Trên cluster nhiều node bạn cần thay bằng Redis hoặc Mongo TTL collection.
 */
const teleLinkStore = new Map<string, TeleLinkEntry>()

function genLinkCode(): string {
  // 8-char alphanumeric (lowercase)
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  let code = ""
  for (let i = 0; i < TELE_CODE_LEN; i++) {
    code += alphabet[randomInt(0, alphabet.length)]
  }
  return code
}

function gcExpiredLinkCodes() {
  const now = Date.now()
  for (const [code, entry] of teleLinkStore) {
    if (entry.expiresAt < now) teleLinkStore.delete(code)
  }
}

/**
 * Phát mã link Telegram cho user. Trả về deep link tới bot.
 * UI hiển thị deep link + QR.
 */
export async function requestTelegramLinkCode(userId: Types.ObjectId | string) {
  await connectDB()
  const user = await findUserOrThrow(userId)
  if (user.telegramId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tài khoản đã liên kết Telegram. Vui lòng huỷ liên kết trước.",
    })
  }

  const opts = await getSiteOptions(["telegram_token", "oauth_telegram_bot_username"])
  if (!opts.telegram_token) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Hệ thống chưa cấu hình Telegram bot",
    })
  }
  const botUsername = opts.oauth_telegram_bot_username || ""
  if (!botUsername) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Admin chưa cấu hình bot username (Login → Telegram)",
    })
  }

  gcExpiredLinkCodes()

  // Reuse existing valid code nếu có
  for (const entry of teleLinkStore.values()) {
    if (entry.userId === String(user._id) && entry.expiresAt > Date.now()) {
      return buildLinkResponse(entry.code, entry.expiresAt, botUsername)
    }
  }

  const code = genLinkCode()
  const now = Date.now()
  teleLinkStore.set(code, {
    userId: String(user._id),
    code,
    createdAt: now,
    expiresAt: now + TELE_LINK_TTL_MS,
  })

  return buildLinkResponse(code, now + TELE_LINK_TTL_MS, botUsername)
}

function buildLinkResponse(code: string, expiresAtMs: number, botUsername: string) {
  const cleanUsername = botUsername.startsWith("@") ? botUsername.slice(1) : botUsername
  return {
    code,
    deepLink: `https://t.me/${cleanUsername}?start=link_${code}`,
    botUsername: cleanUsername,
    expiresAt: expiresAtMs,
    expiresIn: Math.ceil((expiresAtMs - Date.now()) / 1000),
  }
}

/**
 * Lookup link entry by code (dùng từ webhook handler).
 */
export function consumeTelegramLinkCode(code: string): TeleLinkEntry | null {
  gcExpiredLinkCodes()
  const entry = teleLinkStore.get(code)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    teleLinkStore.delete(code)
    return null
  }
  // One-shot: xoá sau khi dùng
  teleLinkStore.delete(code)
  return entry
}

/**
 * Hoàn tất liên kết — gọi từ webhook khi user nhắn `/start link_<code>` cho bot.
 *
 * @param code      Code từ deep link
 * @param chatId    Telegram user_id (chat_id của private chat)
 * @param username  @username Telegram (optional)
 *
 * @returns userId nếu liên kết thành công, null nếu code không hợp lệ
 */
export async function confirmTelegramLink(
  code: string,
  chatId: string,
  username: string | null
): Promise<string | null> {
  const entry = consumeTelegramLinkCode(code)
  if (!entry) return null

  await connectDB()
  // Kiểm tra trùng telegramId — không cho 2 account dùng chung 1 telegram
  const existing = await User.findOne({ telegramId: chatId, _id: { $ne: entry.userId } })
    .select({ _id: 1 })
    .lean()
  if (existing) return null

  const updated = await User.findByIdAndUpdate(
    entry.userId,
    {
      $set: {
        telegramId: chatId,
        telegramUsername: username,
        telegramLinkedAt: new Date(),
      },
    },
    { new: true }
  ).select("username telegramId fullname")

  if (!updated) return null

  // Best-effort gửi welcome
  try {
    const text = await buildTelegramMessage("user_link_success", {
      username: updated.fullname || updated.username,
      time: new Date().toLocaleString("vi-VN"),
    })
    await sendTelegramUserRaw(chatId, text)
  } catch (err) {
    console.error("[confirmTelegramLink] welcome send failed", err)
  }

  return String(updated._id)
}

/**
 * Hủy liên kết Telegram.
 */
export async function unlinkTelegram(userId: Types.ObjectId | string) {
  await connectDB()
  const user = await findUserOrThrow(userId)
  if (!user.telegramId) {
    return { success: true, message: "Tài khoản chưa liên kết Telegram" }
  }
  await User.updateOne(
    { _id: user._id },
    { $set: { telegramId: null, telegramUsername: null, telegramLinkedAt: null } }
  )
  return { success: true, message: "Đã hủy liên kết Telegram" }
}

/**
 * Trạng thái liên kết hiện tại — dùng cho polling.
 */
export async function getTelegramLinkStatus(userId: Types.ObjectId | string) {
  await connectDB()
  const user = await User.findById(userId)
    .select("telegramId telegramUsername telegramLinkedAt emailVerified")
    .lean<{
      telegramId: string | null
      telegramUsername: string | null
      telegramLinkedAt: Date | null
      emailVerified: number
    } | null>()
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Tài khoản không tồn tại" })
  return {
    linked: !!user.telegramId,
    telegramUsername: user.telegramUsername,
    telegramLinkedAt: user.telegramLinkedAt,
    emailVerified: user.emailVerified === 1,
  }
}
