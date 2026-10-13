/**
 * Telegram Login Widget OAuth — verify HMAC-SHA256 hash (không dùng code flow).
 * https://core.telegram.org/widgets/login#checking-authorization
 */
import crypto from "node:crypto"
import type { OAuthUserInfo } from "./types"

export const telegramOAuthService = {
  /** Build redirect tới oauth.telegram.org. botToken dùng để lấy bot_id (phần trước ":"). */
  getAuthUrl(botUsername: string, redirectUri: string, state?: string, botToken?: string): string {
    const botId = botToken ? botToken.split(":")[0] : botUsername
    const params = new URLSearchParams({
      bot_id: botId,
      origin: redirectUri.replace(/\/api\/auth\/oauth\/callback\/telegram.*$/, ""),
      return_to: `${redirectUri}${state ? `?state=${state}` : ""}`,
    })
    return `https://oauth.telegram.org/auth?${params.toString()}`
  },

  /** Verify Telegram login payload bằng HMAC-SHA256(secret=SHA256(botToken)). */
  verifyHash(params: Record<string, string>, botToken: string): boolean {
    const hash = params.hash
    if (!hash) return false

    const checkString = Object.keys(params)
      .filter((k) => k !== "hash")
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("\n")

    const secretKey = crypto.createHash("sha256").update(botToken).digest()
    const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex")
    if (hmac !== hash) return false

    // auth_date không quá 1 giờ
    const authDate = parseInt(params.auth_date || "0", 10)
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > 3600) return false

    return true
  },

  getUserInfo(params: Record<string, string>): OAuthUserInfo {
    const name =
      [params.first_name, params.last_name].filter(Boolean).join(" ") ||
      params.username ||
      `tg_${params.id}`
    return {
      id: params.id,
      name,
      avatar: params.photo_url || undefined,
      raw: params,
    }
  },
}
