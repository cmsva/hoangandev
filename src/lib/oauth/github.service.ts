/**
 * GitHub OAuth 2.0 — fetch-based.
 */
import type { OAuthUserInfo, OAuthProviderConfig } from "./types"

export const githubOAuthService = {
  getAuthUrl(config: OAuthProviderConfig, state?: string): string {
    const rootUrl = "https://github.com/login/oauth/authorize"
    const qs = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: ["read:user", "user:email"].join(" "),
      state: state || "",
    })
    return `${rootUrl}?${qs.toString()}`
  },

  async getUserInfo(code: string, config: OAuthProviderConfig): Promise<OAuthUserInfo> {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!tokenRes.ok) throw new Error("GitHub token exchange failed")
    const { access_token } = (await tokenRes.json()) as { access_token?: string }
    if (!access_token) throw new Error("GitHub access_token missing")

    const headers = { Authorization: `Bearer ${access_token}`, "User-Agent": "oauth-app" }
    const [userRes, emailsRes] = await Promise.all([
      fetch("https://api.github.com/user", { headers, signal: AbortSignal.timeout(15_000) }),
      fetch("https://api.github.com/user/emails", { headers, signal: AbortSignal.timeout(15_000) }),
    ])
    if (!userRes.ok) throw new Error("GitHub userinfo failed")
    const u = (await userRes.json()) as {
      id: number
      login: string
      name?: string
      avatar_url?: string
    }
    let primaryEmail: string | undefined
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean }>
      primaryEmail = emails.find((e) => e.primary)?.email || emails[0]?.email
    }
    return {
      id: String(u.id),
      email: primaryEmail,
      name: u.name || u.login,
      avatar: u.avatar_url,
      raw: u,
    }
  },
}
