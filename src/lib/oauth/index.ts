/**
 * OAuth registry — resolve config từ settings + map provider → service.
 *
 * Settings keys:
 *   oauth_<provider>_client_id / oauth_<provider>_client_secret
 *   telegram: oauth_telegram_bot_username / oauth_telegram_bot_token
 *
 * Redirect URI dựng từ NEXT_PUBLIC_APP_URL.
 */
import { getSiteOptions } from "@/models/setting.model"
import type { OAuthProviderConfig } from "./types"
import { googleOAuthService } from "./google.service"
import { githubOAuthService } from "./github.service"
import { discordOAuthService } from "./discord.service"
import { zaloOAuthService } from "./zalo.service"
import { telegramOAuthService } from "./telegram.service"

export const VALID_PROVIDERS = ["google", "github", "discord", "zalo", "telegram"] as const
export type OAuthProvider = (typeof VALID_PROVIDERS)[number]

export function isValidProvider(p: string): p is OAuthProvider {
  return (VALID_PROVIDERS as readonly string[]).includes(p)
}

export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

export function getCallbackUrl(provider: OAuthProvider): string {
  return `${getBaseUrl()}/api/auth/oauth/callback/${provider}`
}

/** Resolve config cho provider từ DB. Trả null nếu chưa cấu hình. */
export async function getOAuthConfig(provider: OAuthProvider): Promise<OAuthProviderConfig | null> {
  if (provider === "telegram") {
    const opts = await getSiteOptions(["oauth_telegram_bot_username", "oauth_telegram_bot_token"])
    const botUsername = opts.oauth_telegram_bot_username
    const botToken = opts.oauth_telegram_bot_token
    if (!botUsername || !botToken) return null
    return { clientId: botUsername, clientSecret: botToken, redirectUri: getCallbackUrl("telegram") }
  }
  const opts = await getSiteOptions([`oauth_${provider}_client_id`, `oauth_${provider}_client_secret`])
  const clientId = opts[`oauth_${provider}_client_id`]
  const clientSecret = opts[`oauth_${provider}_client_secret`]
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret, redirectUri: getCallbackUrl(provider) }
}

export {
  googleOAuthService,
  githubOAuthService,
  discordOAuthService,
  zaloOAuthService,
  telegramOAuthService,
}
