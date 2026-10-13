/**
 * Public origin helper — resolve origin thật của request.
 *
 * Tại sao cần?
 *   Sau Cloudflare/nginx, `request.url` của Next.js Route Handler thường lấy host
 *   từ socket nội bộ (vd `0.0.0.0:3000`). Nếu redirect bằng
 *   `new URL(path, request.url)` → trình duyệt sẽ bị bounce sang `0.0.0.0:3000`,
 *   gây lỗi "không truy cập được" trên production.
 *
 * Thứ tự ưu tiên:
 *   1. `process.env.NEXT_PUBLIC_APP_URL`  (admin set trong .env — nguồn chính thống)
 *   2. Header `x-forwarded-proto` + `x-forwarded-host` (Cloudflare/nginx truyền)
 *   3. Header `host` (proto = https nếu prod, http nếu dev)
 *   4. Cuối cùng fallback `request.url`
 */

function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw.trim())
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

/**
 * Trả origin (proto + host, không slash cuối) suy ra từ env hoặc request.
 */
export function getPublicOrigin(request: Request): string {
  const fromEnv = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (fromEnv) return fromEnv

  const headers = request.headers
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0].trim()
  const forwardedHost = headers.get("x-forwarded-host")?.trim()
  if (forwardedHost) {
    const proto =
      forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http")
    return `${proto}://${forwardedHost}`
  }

  const host = headers.get("host")?.trim()
  if (host && !/^0\.0\.0\.0/.test(host)) {
    const proto =
      forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http")
    return `${proto}://${host}`
  }

  // Last resort — có thể trỏ vào 0.0.0.0 nếu chạy thẳng không proxy.
  try {
    const u = new URL(request.url)
    return `${u.protocol}//${u.host}`
  } catch {
    return "http://localhost:3000"
  }
}

/**
 * Build absolute URL từ path tương đối.
 * Ưu tiên dùng cho redirect ở Route Handler để tránh bounce sang `0.0.0.0:3000`.
 */
export function buildAbsoluteUrl(request: Request, path: string): URL {
  const origin = getPublicOrigin(request)
  return new URL(path.startsWith("/") ? path : `/${path}`, origin)
}
