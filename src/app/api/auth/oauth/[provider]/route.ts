/**
 * OAuth init — GET /api/auth/oauth/[provider]
 * Tạo CSRF state (cookie) + (Zalo) PKCE verifier, redirect tới authUrl của provider.
 */
import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { cookies } from "next/headers"
import {
  isValidProvider,
  getOAuthConfig,
  googleOAuthService,
  githubOAuthService,
  discordOAuthService,
  zaloOAuthService,
  telegramOAuthService,
} from "@/lib/oauth"

const IS_PROD = process.env.NODE_ENV === "production"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params

  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: "Provider không hợp lệ" }, { status: 400 })
  }

  const config = await getOAuthConfig(provider)
  if (!config) {
    return NextResponse.json(
      { error: `Đăng nhập ${provider} chưa được cấu hình. Vui lòng liên hệ admin.` },
      { status: 400 }
    )
  }

  const state = crypto.randomBytes(32).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  })

  let authUrl: string
  switch (provider) {
    case "google":
      authUrl = googleOAuthService.getAuthUrl(config, state)
      break
    case "github":
      authUrl = githubOAuthService.getAuthUrl(config, state)
      break
    case "discord":
      authUrl = discordOAuthService.getAuthUrl(config, state)
      break
    case "zalo": {
      const { codeVerifier, codeChallenge } = zaloOAuthService.generatePKCE()
      cookieStore.set("oauth_zalo_code_verifier", codeVerifier, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      })
      authUrl = zaloOAuthService.getAuthUrl(config, { state, codeChallenge })
      break
    }
    case "telegram":
      authUrl = telegramOAuthService.getAuthUrl(
        config.clientId,
        config.redirectUri,
        state,
        config.clientSecret
      )
      break
    default:
      return NextResponse.json({ error: "Provider không hợp lệ" }, { status: 400 })
  }

  return NextResponse.redirect(authUrl)
}
