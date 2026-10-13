/**
 * Google OAuth 2.0 — fetch-based (không dùng axios).
 */
import type { OAuthUserInfo, OAuthProviderConfig } from "./types"

export const googleOAuthService = {
  getAuthUrl(config: OAuthProviderConfig, state?: string): string {
    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth"
    const qs = new URLSearchParams({
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
      state: state || "",
    })
    return `${rootUrl}?${qs.toString()}`
  },

  async getUserInfo(code: string, config: OAuthProviderConfig): Promise<OAuthUserInfo> {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!tokenRes.ok) throw new Error("Google token exchange failed")
    const { access_token } = (await tokenRes.json()) as { access_token?: string }
    if (!access_token) throw new Error("Google access_token missing")

    const userRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!userRes.ok) throw new Error("Google userinfo failed")
    const u = (await userRes.json()) as {
      id: string
      email?: string
      name?: string
      picture?: string
    }
    return { id: u.id, email: u.email, name: u.name, avatar: u.picture, raw: u }
  },
}
