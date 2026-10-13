import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"
import { verifyToken } from "@/services/auth.service"

export const runtime = "nodejs"

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads")
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"])

function assertAdmin(req: Request): NextResponse | null {
  const cookie = req.headers.get("cookie") || ""
  const match = /(?:^|;\s*)token=([^;]+)/.exec(cookie)
  if (!match) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const claims = verifyToken(decodeURIComponent(match[1]))
  if (!claims?.sub) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (claims.admin !== 1) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return null
}

async function walk(dir: string, base = ""): Promise<Array<{ url: string; name: string; bucket: string; size: number; modifiedAt: string }>> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  const files: Array<{ url: string; name: string; bucket: string; size: number; modifiedAt: string }> = []

  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...await walk(abs, rel))
      continue
    }
    const ext = path.extname(entry.name).toLowerCase()
    if (!IMAGE_EXTS.has(ext)) continue
    const stat = await fs.stat(abs)
    const parts = rel.split("/")
    files.push({
      url: `/uploads/${rel.replace(/\\/g, "/")}`,
      name: entry.name,
      bucket: parts[0] || "misc",
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    })
  }
  return files
}

export async function GET(req: Request) {
  const authError = assertAdmin(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") || "").toLowerCase().trim()
  const bucket = (searchParams.get("bucket") || "").trim()

  let files = await walk(UPLOAD_ROOT)
  if (bucket) files = files.filter((file) => file.bucket === bucket)
  if (q) files = files.filter((file) => file.name.toLowerCase().includes(q) || file.url.toLowerCase().includes(q))

  files.sort((a, b) => +new Date(b.modifiedAt) - +new Date(a.modifiedAt))
  return NextResponse.json({ items: files.slice(0, 300) })
}
