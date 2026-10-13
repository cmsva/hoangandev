/**
 * Discord OAuth 2.0 — fetch-based.
 */
import type { OAuthUserInfo, OAuthProviderConfig } from "./types"

export const discordOAuthService = {
  getAuthUrl(config: OAuthProviderConfig, state?: string): string {
    const rootUrl = "https://discord.com/api/oauth2/authorize"
    const qs = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: ["identify", "email"].join(" "),
      state: state || "",
    })
    return `${rootUrl}?${qs.toString()}`
  },

  async getUserInfo(code: string, config: OAuthProviderConfig): Promise<OAuthUserInfo> {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!tokenRes.ok) throw new Error("Discord token exchange failed")
    const { access_token } = (await tokenRes.json()) as { access_token?: string }
    if (!access_token) throw new Error("Discord access_token missing")

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!userRes.ok) throw new Error("Discord userinfo failed")
    const u = (await userRes.json()) as {
      id: string
      email?: string
      username: string
      global_name?: string
      avatar?: string
    }
    return {
      id: u.id,
      email: u.email,
      name: u.global_name || u.username,
      avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : undefined,
      raw: u,
    }
  },
}
