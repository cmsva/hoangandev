/**
 * Upload Source ZIP — admin only.
 *
 * Nhận multipart/form-data field "file" (ZIP source code) → lưu qua storage
 * dispatcher dùng CHUNG cấu hình lưu trữ ảnh (local | Amazon S3 | Cloudflare R2).
 * Trả về public URL trực tiếp để admin dán vào codeUrl / sourceZipUrl.
 *
 * Khác với upload ảnh:
 *  - Giới hạn riêng 200MB (ảnh chỉ ≤ 50MB).
 *  - Chỉ nhận file .zip.
 *  - Bucket cố định "deploy-codes".
 *  - Nếu provider = local → trả ABSOLUTE URL (https://app/uploads/...) để worker
 *    deploy tải qua HTTP được (không nhầm thành path local trên aaPanel).
 */
import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { verifyToken } from "@/services/auth.service"
import { putObject } from "@/services/storage.service"

export const runtime = "nodejs"
// Cho phép body lớn — file ZIP source tối đa 200MB.
export const maxDuration = 300

const SOURCE_BUCKET = "deploy-codes"
const MAX_BYTES = 200 * 1024 * 1024 // 200MB

// ZIP có nhiều MIME tùy trình duyệt/OS. Chấp nhận theo cả MIME lẫn đuôi .zip.
const ZIP_MIMES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream",
  "multipart/x-zip",
])

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
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 })
  }
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file" }, { status: 400 })
  }

  const lowerName = file.name.toLowerCase()
  const isZip = ZIP_MIMES.has(file.type) || lowerName.endsWith(".zip")
  if (!isZip) {
    return NextResponse.json({ error: "Chỉ chấp nhận file .zip" }, { status: 400 })
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "File rỗng" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File quá lớn (tối đa ${Math.round(MAX_BYTES / 1024 / 1024)}MB)` },
      { status: 400 }
    )
  }

  // ─── Save qua dispatcher (local | s3 | r2) ────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer())
  const name = crypto.randomBytes(16).toString("hex") + ".zip"

  try {
    let url = await putObject({
      buffer,
      bucket: SOURCE_BUCKET,
      key: name,
      contentType: "application/zip",
    })

    // Provider local trả URL tương đối → build absolute để worker deploy tải qua HTTP.
    if (url.startsWith("/")) {
      const base = (
        process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
      ).replace(/\/+$/, "")
      url = base + url
    }

    return NextResponse.json({ url, name, size: file.size })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Lưu file thất bại" },
      { status: 500 }
    )
  }
}
