/**
 * OAuth callback — GET /api/auth/oauth/callback/[provider]
 * Verify state/PKCE → getUserInfo → findOrCreateOAuthUser → set cookie token → popup postMessage.
 */
import { NextResponse } from "next/server"
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
import type { OAuthUserInfo } from "@/lib/oauth/types"
import { findOrCreateOAuthUser } from "@/services/oauth.service"
import { insertLog } from "@/services/log.service"

const IS_PROD = process.env.NODE_ENV === "production"

// ─── Popup HTML helpers ──────────────────────────────────────────────────
function popupSuccess(): NextResponse {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Đăng nhập</title></head><body>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "oauth-success" }, window.location.origin);
    window.close();
  } else {
    window.location.href = "/dashboard";
  }
</script>
<p style="font-family:sans-serif;text-align:center;margin-top:2rem">Đăng nhập thành công! Đang chuyển hướng...</p>
</body></html>`
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

function popupError(error: string): NextResponse {
  const safe = JSON.stringify(error)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lỗi đăng nhập</title></head><body>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "oauth-error", error: ${safe} }, window.location.origin);
    window.close();
  } else {
    window.location.href = "/authentication/login?error=" + encodeURIComponent(${safe});
  }
</script>
<p style="font-family:sans-serif;text-align:center;margin-top:2rem">Đăng nhập thất bại. Đang chuyển hướng...</p>
</body></html>`
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  if (errorParam) return popupError("oauth_denied")
  if (!isValidProvider(provider)) return popupError("invalid_provider")

  const isTelegram = provider === "telegram"
  if (!isTelegram && !code) return popupError("no_code")

  const cookieStore = await cookies()

  // CSRF state (Telegram dùng hash verify riêng nên skip)
  if (!isTelegram) {
    const stored = cookieStore.get(`oauth_state_${provider}`)?.value
    if (!stored || stored !== state) return popupError("csrf_mismatch")
    cookieStore.delete(`oauth_state_${provider}`)
  }

  const config = await getOAuthConfig(provider)
  if (!config) return popupError("not_configured")

  // Exchange → userInfo
  let userInfo: OAuthUserInfo
  try {
    switch (provider) {
      case "google":
        userInfo = await googleOAuthService.getUserInfo(code!, config)
        break
      case "github":
        userInfo = await githubOAuthService.getUserInfo(code!, config)
        break
      case "discord":
        userInfo = await discordOAuthService.getUserInfo(code!, config)
        break
      case "zalo": {
        const verifier = cookieStore.get("oauth_zalo_code_verifier")?.value
        if (!verifier) return popupError("missing_verifier")
        cookieStore.delete("oauth_zalo_code_verifier")
        userInfo = await zaloOAuthService.getUserInfo(code!, config, verifier)
        break
      }
      case "telegram": {
        const tgParams: Record<string, string> = {}
        url.searchParams.forEach((v, k) => {
          tgParams[k] = v
        })
        if (!telegramOAuthService.verifyHash(tgParams, config.clientSecret)) {
          return popupError("telegram_hash_invalid")
        }
        userInfo = telegramOAuthService.getUserInfo(tgParams)
        break
      }
      default:
        return popupError("invalid_provider")
    }
  } catch (err) {
    console.error(`[OAuth] ${provider} callback error:`, err)
    return popupError("oauth_failed")
  }

  if (!userInfo.id) return popupError("no_user_id")

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  const device = request.headers.get("user-agent") || null

  let result
  try {
    result = await findOrCreateOAuthUser({ provider, userInfo, ip, device })
  } catch (err) {
    console.error(`[OAuth] ${provider} findOrCreate error:`, err)
    return popupError("oauth_failed")
  }

  if (result.banned) return popupError("banned")

  // Set cookie token (cùng config với login thường)
  cookieStore.set("token", result.token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: result.ttlSeconds,
  })
  // Hint cookie (non-httpOnly) → client biết đã login để mở socket.
  cookieStore.set("auth", "1", {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: result.ttlSeconds,
  })

  // Log + notify (best-effort)
  insertLog({
    userId: result.userId,
    action: result.isNew ? `Đăng ký qua ${provider}` : `Đăng nhập qua ${provider}`,
    ip,
    device,
  }).catch(() => {})

  void import("@/services/notify.service").then((m) => {
    if (result!.isNew) {
      m.notifyRegister({ userId: result!.userId, ip, device, ref: `OAuth ${provider}` }).catch(() => {})
    }
    m.notifyLogin({ userId: result!.userId, ip, device }).catch(() => {})
  })

  return popupSuccess()
}
