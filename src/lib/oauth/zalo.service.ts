/**
 * Zalo OAuth — PKCE + secret_key header. fetch-based.
 */
import crypto from "node:crypto"
import type { OAuthUserInfo, OAuthProviderConfig } from "./types"

export const zaloOAuthService = {
  generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString("hex")
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
    return { codeVerifier, codeChallenge }
  },

  getAuthUrl(config: OAuthProviderConfig, options: { state: string; codeChallenge: string }): string {
    const rootUrl = "https://oauth.zaloapp.com/v4/permission"
    const qs = new URLSearchParams({
      app_id: config.clientId,
      redirect_uri: config.redirectUri,
      state: options.state,
      code_challenge: options.codeChallenge,
    })
    return `${rootUrl}?${qs.toString()}`
  },

  async getUserInfo(
    code: string,
    config: OAuthProviderConfig,
    codeVerifier: string
  ): Promise<OAuthUserInfo> {
    const tokenRes = await fetch("https://oauth.zaloapp.com/v4/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: config.clientSecret,
      },
      body: new URLSearchParams({
        code,
        app_id: config.clientId,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!tokenRes.ok) throw new Error("Zalo token exchange failed")
    const { access_token } = (await tokenRes.json()) as { access_token?: string }
    if (!access_token) throw new Error("Zalo access_token missing")

    const userRes = await fetch(
      "https://graph.zalo.me/v2.0/me?fields=id,name,picture",
      { headers: { access_token }, signal: AbortSignal.timeout(15_000) }
    )
    if (!userRes.ok) throw new Error("Zalo userinfo failed")
    const u = (await userRes.json()) as {
      id: string
      name?: string
      picture?: { data?: { url?: string } }
    }
    return { id: u.id, name: u.name, avatar: u.picture?.data?.url, raw: u }
  },
}
