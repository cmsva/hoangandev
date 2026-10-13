/**
 * Password Reset Service (MVC layer 2) — link-based reset flow.
 *
 * Flow:
 *   1. requestPasswordReset(email): tạo token random, lưu hash vào User.resetToken
 *      + expiry 30 phút, gửi mail chứa link /authentication/reset-password?token=...&uid=...
 *   2. resetPassword(uid, token, newPassword): verify token + expiry → đổi mật khẩu,
 *      clear token, invalidate session.
 *
 * Bảo mật:
 *   - Token random 32 bytes, chỉ lưu SHA-256 hash trong DB (không lưu plaintext).
 *   - requestPasswordReset LUÔN trả success (không lộ email tồn tại hay không).
 */
import { TRPCError } from "@trpc/server"
import { createHash, randomBytes } from "node:crypto"
import { connectDB } from "@/lib/db"
import { User } from "@/models/user.model"
import { hashPassword } from "@/services/auth.service"
import { sendMailToUser } from "@/lib/send-mail"
import { getBaseUrl } from "@/lib/oauth"
import { escapeRegex } from "@/lib/sanitize"

const RESET_TTL_MS = 30 * 60 * 1000 // 30 phút

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Phát link reset + gửi mail. Luôn trả success kể cả khi email không tồn tại.
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  await connectDB()
  const normalized = email.toLowerCase().trim()

  const user = await User.findOne({
    email: { $regex: new RegExp(`^${escapeRegex(normalized)}$`, "i") },
  }).select("_id username fullname email provider")

  // Không lộ email tồn tại — luôn trả success
  if (!user) return { success: true }

  // User OAuth-only (placeholder email) không cho reset qua mail
  if (user.email.endsWith("@oauth.local")) return { success: true }

  const token = randomBytes(32).toString("hex")
  const tokenHash = hashToken(token)
  const expires = new Date(Date.now() + RESET_TTL_MS)

  await User.updateOne(
    { _id: user._id },
    { $set: { resetToken: tokenHash, resetTokenExpires: expires } }
  )

  const resetLink = `${getBaseUrl()}/authentication/reset-password?uid=${user._id}&token=${token}`

  void sendMailToUser(user.email, "forgot_password", {
    username: user.fullname || user.username,
    reset_link: resetLink,
  }).catch((err) => console.error("[requestPasswordReset]", err))

  return { success: true }
}

/**
 * Verify token + đổi mật khẩu mới.
 */
export async function resetPassword(input: {
  uid: string
  token: string
  newPassword: string
}): Promise<{ success: boolean; userId: string }> {
  await connectDB()

  if (!/^[a-f\d]{24}$/i.test(input.uid)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Liên kết không hợp lệ" })
  }

  const user = await User.findById(input.uid).select(
    "_id resetToken resetTokenExpires email username"
  )
  if (!user || !user.resetToken || !user.resetTokenExpires) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Liên kết không hợp lệ hoặc đã dùng" })
  }

  if (user.resetTokenExpires.getTime() < Date.now()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Liên kết đã hết hạn, vui lòng yêu cầu lại" })
  }

  if (hashToken(input.token) !== user.resetToken) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Liên kết không hợp lệ" })
  }

  const hashed = await hashPassword(input.newPassword)
  await User.updateOne(
    { _id: user._id },
    {
      $set: { password: hashed, resetToken: null, resetTokenExpires: null, token: null },
    }
  )

  return { success: true, userId: String(user._id) }
}
