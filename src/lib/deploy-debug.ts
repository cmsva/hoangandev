/**
 * deploy-debug — file logger chuyên dụng để debug flow tạo website auto.
 *
 * Mục đích: khi tạo web auto bị lỗi, ghi TOÀN BỘ chi tiết (request/response
 * aaPanel, Cloudflare, từng bước, stack trace) ra 1 file log để dev đọc & fix.
 *
 * Bật/tắt qua env `DEPLOY_DEBUG`:
 *   - "1" / "true" / "on"  → bật (mặc định bật ở NODE_ENV !== production).
 *   - "0" / "false" / "off" → tắt hoàn toàn (no-op, không tốn I/O).
 *
 * Đường dẫn file: env `DEPLOY_DEBUG_FILE` hoặc mặc định `<cwd>/logs/deploy-debug.log`.
 *
 * An toàn:
 *   - Tự mask token/key/password dài để không leak credential vào log.
 *   - Mọi lỗi I/O đều nuốt (best-effort) — KHÔNG bao giờ làm hỏng luồng deploy.
 *   - Append đồng bộ (fs.appendFileSync) để thứ tự dòng chính xác khi debug.
 */
import fs from "node:fs"
import path from "node:path"

const isProd = process.env.NODE_ENV === "production"

function resolveEnabled(): boolean {
  const raw = (process.env.DEPLOY_DEBUG || "").trim().toLowerCase()
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return true
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false
  // Mặc định: bật ở dev, tắt ở prod (tránh đầy đĩa server thật).
  return !isProd
}

const ENABLED = resolveEnabled()

function resolveLogFile(): string {
  const custom = (process.env.DEPLOY_DEBUG_FILE || "").trim()
  if (custom) return custom
  return path.join(process.cwd(), "logs", "deploy-debug.log")
}

const LOG_FILE = resolveLogFile()
let dirEnsured = false

function ensureDir(): void {
  if (dirEnsured) return
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    dirEnsured = true
  } catch {
    /* ignore */
  }
}

// ─── Mask helpers ────────────────────────────────────────────────────────────

const SENSITIVE_KEY_RE = /(api[_-]?key|apikey|token|password|passwd|secret|authorization|cookie|request_token)/i

/** Mask 1 chuỗi credential: giữ 3 ký tự đầu/cuối, ẩn giữa. */
function maskValue(value: string): string {
  if (value.length <= 8) return "***"
  return `${value.slice(0, 3)}***${value.slice(-3)}`
}

/** Deep-clone + mask các field nhạy cảm. Cắt chuỗi/array quá dài để log gọn. */
function sanitize(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return input
  if (depth > 6) return "[max-depth]"

  if (typeof input === "string") {
    return input.length > 4000 ? `${input.slice(0, 4000)}…[+${input.length - 4000}]` : input
  }
  if (typeof input === "number" || typeof input === "boolean") return input
  if (input instanceof Error) {
    return { name: input.name, message: input.message, stack: input.stack }
  }
  if (Array.isArray(input)) {
    const arr = input.slice(0, 50).map((v) => sanitize(v, depth + 1))
    if (input.length > 50) arr.push(`…[+${input.length - 50} more]`)
    return arr
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k) && typeof v === "string") {
        out[k] = maskValue(v)
      } else {
        out[k] = sanitize(v, depth + 1)
      }
    }
    return out
  }
  return String(input)
}

function write(line: string): void {
  if (!ENABLED) return
  ensureDir()
  try {
    fs.appendFileSync(LOG_FILE, line + "\n", "utf8")
  } catch {
    /* best-effort: không làm hỏng deploy */
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const deployDebugEnabled = ENABLED
export const deployDebugFile = LOG_FILE

export interface DeployDebugMeta {
  orderId?: string
  domain?: string
  step?: string
  [key: string]: unknown
}

/** Ghi 1 dòng debug. `data` được sanitize (mask credential, cắt dài). */
export function deployDebug(scope: string, message: string, data?: DeployDebugMeta): void {
  if (!ENABLED) return
  const entry = {
    t: new Date().toISOString(),
    scope,
    msg: message,
    ...(data ? { data: sanitize(data) } : {}),
  }
  let line: string
  try {
    line = JSON.stringify(entry)
  } catch {
    line = JSON.stringify({ t: entry.t, scope, msg: message, data: "[unserializable]" })
  }
  write(line)
}

/** Ghi lỗi kèm stack trace đầy đủ. */
export function deployDebugError(scope: string, message: string, err: unknown, data?: DeployDebugMeta): void {
  if (!ENABLED) return
  const errObj =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { value: sanitize(err) }
  deployDebug(scope, `❌ ${message}`, { ...data, error: errObj })
}

/**
 * Ghi marker bắt đầu 1 phiên deploy (dễ tìm trong file log).
 * Trả về 1 hàm `done(status)` để ghi marker kết thúc + thời lượng.
 */
export function deployDebugSession(orderId: string, domain: string): (status: string, extra?: DeployDebugMeta) => void {
  const start = Date.now()
  deployDebug("session", "═══════════ BẮT ĐẦU DEPLOY ═══════════", { orderId, domain })
  return (status: string, extra?: DeployDebugMeta) => {
    deployDebug("session", `═══════════ KẾT THÚC DEPLOY [${status}] ═══════════`, {
      orderId,
      domain,
      durationMs: Date.now() - start,
      ...extra,
    })
  }
}
