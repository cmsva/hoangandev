/**
 * Profile Controller — Business logic cho /customer/profile.
 *
 * Tách biệt theo MVC strict:
 *  - Validators: kiểm tra input nghiệp vụ
 *  - Repository: query DB
 *  - Update operations: thay đổi state user
 *  - 2FA helpers: TOTP generate/verify
 *
 * KHÔNG nhận ctx (HTTP context) — controller pure.
 */
import { TRPCError } from "@trpc/server"
import { authenticator } from "otplib"
import { randomBytes } from "node:crypto"
import { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import { User, type IUser } from "@/models/user.model"
import { hashPassword, verifyPassword } from "@/services/auth.service"

// otplib config — chuẩn Google Authenticator
authenticator.options = { window: 1, step: 30, digits: 6 }
const ISSUER_NAME = "VanKhanh"

// ─── Repository ────────────────────────────────────────────────────────────

async function findUserById(userId: Types.ObjectId | string): Promise<IUser> {
  await connectDB()
  const user = await User.findById(userId)
  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tài khoản không tồn tại" })
  }
  return user
}

// ─── Read profile ──────────────────────────────────────────────────────────

export async function getProfile(userId: Types.ObjectId | string) {
  await connectDB()
  const user = await User.findById(userId)
    .select("-password -token -otp -secretKey2fa")
    .lean<Record<string, any> | null>()

  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tài khoản không tồn tại" })
  }

  // Channel availability — để client ẩn/hiện UI xác minh email & liên kết Telegram
  const { getSiteOptions } = await import("@/models/setting.model")
  const opts = await getSiteOptions([
    "smtp_status",
    "smtp_host",
    "smtp_user",
    "telegram_token",
    "oauth_telegram_bot_username",
  ])
  const mailEnabled = opts.smtp_status === "1" && !!opts.smtp_host && !!opts.smtp_user
  const telegramLinkEnabled = !!opts.telegram_token && !!opts.oauth_telegram_bot_username

  return { ...user, mailEnabled, telegramLinkEnabled }
}

export async function getRecentLogs(userId: Types.ObjectId | string, limit = 5) {
  await connectDB()
  const { Log } = await import("@/models/log.model")
  const logs = await Log.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Array<{ action: string; ip: string | null; device: string | null; createdAt: Date }>>()
  return logs
}

// ─── Validators (pure) ─────────────────────────────────────────────────────

function assertPasswordStrength(password: string) {
  if (password.length < 6) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mật khẩu tối thiểu 6 ký tự" })
  }
  if (password.length > 128) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mật khẩu tối đa 128 ký tự" })
  }
}

function assertEmailFormat(email: string) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Email không hợp lệ" })
  }
}

// ─── Update operations ─────────────────────────────────────────────────────

export async function changePassword(
  userId: Types.ObjectId | string,
  oldPassword: string,
  newPassword: string
) {
  assertPasswordStrength(newPassword)

  const user = await findUserById(userId)
  const ok = await verifyPassword(oldPassword, user.password)
  if (!ok) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mật khẩu cũ không đúng" })
  }
  if (oldPassword === newPassword) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Mật khẩu mới phải khác mật khẩu cũ",
    })
  }

  const hashed = await hashPassword(newPassword)
  await User.updateOne({ _id: user._id }, { $set: { password: hashed } })
  return { success: true }
}

export async function updateFullname(
  userId: Types.ObjectId | string,
  fullname: string
) {
  const trimmed = fullname.trim()
  if (trimmed.length < 2) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Họ tên tối thiểu 2 ký tự" })
  }
  if (trimmed.length > 100) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Họ tên tối đa 100 ký tự" })
  }

  await connectDB()
  await User.updateOne({ _id: userId }, { $set: { fullname: trimmed } })
  return { success: true, fullname: trimmed }
}

export async function updateEmail(
  userId: Types.ObjectId | string,
  newEmail: string
) {
  const email = newEmail.trim().toLowerCase()
  assertEmailFormat(email)

  await connectDB()
  // Check duplicate
  const exists = await User.findOne({ email, _id: { $ne: userId } })
    .select({ _id: 1 })
    .lean()
  if (exists) {
    throw new TRPCError({ code: "CONFLICT", message: "Email đã được sử dụng" })
  }

  await User.updateOne({ _id: userId }, { $set: { email } })
  return { success: true, email }
}

export async function updateAvatar(
  userId: Types.ObjectId | string,
  avatar: string
) {
  const url = avatar.trim()
  if (url && url.length > 500) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "URL ảnh quá dài" })
  }
  // Cho phép xóa avatar bằng empty string
  await connectDB()
  await User.updateOne(
    { _id: userId },
    { $set: { avatar: url || null } }
  )
  return { success: true, avatar: url || null }
}

// ─── 2FA helpers ───────────────────────────────────────────────────────────

/**
 * Convert hex secret → base32 (chuẩn TOTP)
 * otplib mặc định dùng base32, hex secret phải convert.
 */
function hexToBase32(hex: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  let bits = ""
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0")
  let result = ""
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0")
    result += alphabet[parseInt(chunk, 2)]
  }
  return result
}

function verifyTotp(hexSecret: string, code: string): boolean {
  if (!hexSecret || !code) return false
  const base32 = hexToBase32(hexSecret)
  return authenticator.verify({ token: code, secret: base32 })
}

/** Lấy thông tin 2FA setup (base32 secret + otpauth URL cho QR). */
export async function get2FASetup(userId: Types.ObjectId | string) {
  const user = await findUserById(userId)
  if (!user.secretKey2fa) {
    // User cũ chưa có key — UI sẽ hiện nút "Tạo khóa"
    return {
      base32Secret: null,
      otpauthUrl: null,
      enabled: user.status2fa === 1,
    }
  }
  const base32 = hexToBase32(user.secretKey2fa)
  const otpauthUrl = authenticator.keyuri(user.email, ISSUER_NAME, base32)
  return {
    base32Secret: base32,
    otpauthUrl,
    enabled: user.status2fa === 1,
  }
}

/** Tạo lại secret key (chỉ khi 2FA chưa bật). */
export async function regenerate2FASecret(userId: Types.ObjectId | string) {
  const user = await findUserById(userId)
  if (user.status2fa === 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Phải tắt 2FA trước khi tạo lại khóa",
    })
  }
  const newSecret = randomBytes(20).toString("hex")
  await User.updateOne({ _id: user._id }, { $set: { secretKey2fa: newSecret } })
  return get2FASetup(user._id)
}

/** Bật 2FA — cần code TOTP hợp lệ. */
export async function enable2FA(
  userId: Types.ObjectId | string,
  totpCode: string
) {
  const user = await findUserById(userId)
  if (user.status2fa === 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "2FA đã bật rồi" })
  }
  if (!user.secretKey2fa) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Tài khoản chưa có khóa 2FA",
    })
  }
  const ok = verifyTotp(user.secretKey2fa, totpCode)
  if (!ok) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mã xác minh không đúng" })
  }
  await User.updateOne({ _id: user._id }, { $set: { status2fa: 1 } })
  return { success: true }
}

/** Tắt 2FA — cần code TOTP hợp lệ. */
export async function disable2FA(
  userId: Types.ObjectId | string,
  totpCode: string
) {
  const user = await findUserById(userId)
  if (user.status2fa !== 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "2FA chưa được bật" })
  }
  const ok = verifyTotp(user.secretKey2fa || "", totpCode)
  if (!ok) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mã xác minh không đúng" })
  }
  await User.updateOne({ _id: user._id }, { $set: { status2fa: 0 } })
  return { success: true }
}
