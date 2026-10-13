/**
 * Upload API — admin only.
 *
 * Accepts multipart/form-data with field "file" → lưu qua storage dispatcher
 * (local | Amazon S3 | Cloudflare R2 tùy cấu hình admin). Returns public URL.
 *
 * Giới hạn kích thước lấy động từ cấu hình lưu trữ (admin chỉnh được).
 * Bucket whitelisted để tránh path traversal.
 */
import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { verifyToken } from "@/services/auth.service"
import { putObject } from "@/services/storage.service"
import { getStorageConfig } from "@/lib/storage-config"

export const runtime = "nodejs"

const ALLOWED_BUCKETS = new Set([
  "products",
  "posts",
  "logos",
  "services",
  "categories",
  "site",
  "misc",
  "websites",
])
// SVG bị loại — file XML có thể chứa <script>, gây XSS khi serve trực tiếp.
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg"
    case "image/png": return "png"
    case "image/webp": return "webp"
    case "image/gif": return "gif"
    default: return "bin"
  }
}

export async function POST(req: Request) {
  // ─── Auth: admin token cookie ────────────────────────────────────────────
  const cookie = req.headers.get("cookie") || ""
  const match = /(?:^|;\s*)token=([^;]+)/.exec(cookie)
  if (!match) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const claims = verifyToken(decodeURIComponent(match[1]))
  if (!claims?.sub) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }
  if (claims.admin !== 1) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // ─── Parse form ──────────────────────────────────────────────────────────
  const form = await req.formData()
  const file = form.get("file")
  const bucket = String(form.get("bucket") || "misc")

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({ error: "Định dạng không hỗ trợ" }, { status: 400 })
  }

  // Giới hạn size lấy động từ cấu hình lưu trữ (admin chỉnh được).
  const cfg = await getStorageConfig()
  if (file.size > cfg.maxBytes) {
    const maxMb = Math.round(cfg.maxBytes / 1024 / 1024)
    return NextResponse.json({ error: `File quá lớn (tối đa ${maxMb}MB)` }, { status: 400 })
  }

  // ─── Save qua dispatcher (local | s3 | r2) ────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = extFromMime(file.type)
  const name = crypto.randomBytes(16).toString("hex") + "." + ext

  try {
    const url = await putObject({
      buffer,
      bucket,
      key: name,
      contentType: file.type,
    })
    return NextResponse.json({ url, name, size: file.size })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Lưu file thất bại" },
      { status: 500 }
    )
  }
}
