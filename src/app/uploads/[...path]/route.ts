/**
 * Serve file upload tại /uploads/<bucket>/<file>.
 *
 * LÝ DO: thư mục public/ của Next.js là snapshot lúc `next build`. File upload
 * lúc RUNTIME (qua /api/admin/upload) ghi vào public/uploads/ nhưng KHÔNG nằm
 * trong build manifest → `next start` trả 404. Route handler này đọc file trực
 * tiếp từ disk nên phục vụ được cả file upload sau build.
 *
 * File commit sẵn lúc build vẫn được Next serve tĩnh (nhanh hơn, không tới route
 * này); chỉ file runtime cache-miss mới rơi xuống đây.
 */
import { NextResponse } from "next/server"
import path from "node:path"
import fs from "node:fs/promises"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads")

// Chỉ phục vụ ảnh whitelisted — khớp với /api/admin/upload (SVG bị loại vì XSS).
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params

  if (!segments || segments.length === 0) {
    return new NextResponse("Not found", { status: 404 })
  }

  // Resolve + chống path traversal: file BẮT BUỘC nằm trong UPLOAD_ROOT.
  const abs = path.resolve(UPLOAD_ROOT, segments.join("/"))
  if (abs !== UPLOAD_ROOT && !abs.startsWith(UPLOAD_ROOT + path.sep)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const ext = path.extname(abs).slice(1).toLowerCase()
  const mime = MIME_BY_EXT[ext]
  if (!mime) {
    return new NextResponse("Unsupported media type", { status: 415 })
  }

  try {
    const file = await fs.readFile(abs)
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": mime,
        // Tên file là hash ngẫu nhiên (immutable) → cache mạnh tay.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
