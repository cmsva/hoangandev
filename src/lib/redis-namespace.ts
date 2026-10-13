

function deriveDefaultPrefix(): string {
  const explicit = process.env.REDIS_KEY_PREFIX?.trim()
  if (explicit) return sanitize(explicit)

  const url = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (url) {
    try {
      const u = new URL(url)
      return sanitize(u.host)
    } catch {
      // ignore
    }
  }
  return "app"
}

function sanitize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || "app"
}

export const REDIS_NAMESPACE = deriveDefaultPrefix()

/** Chuyển logical key thành physical key có prefix domain. */
export function toPhysicalKey(key: string): string {
  return `${REDIS_NAMESPACE}:${key}`
}

/** Strip prefix khỏi physical key để hiển thị logical key cho admin. */
export function fromPhysicalKey(physical: string): string {
  const prefix = `${REDIS_NAMESPACE}:`
  return physical.startsWith(prefix) ? physical.slice(prefix.length) : physical
}

/** Build SCAN MATCH pattern dựa trên user pattern (đã được restrict trong namespace). */
export function buildScanPattern(userPattern: string): string {
  return `${REDIS_NAMESPACE}:${userPattern}`
}
