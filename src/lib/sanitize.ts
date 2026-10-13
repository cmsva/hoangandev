import { z } from "zod"
import DOMPurify from "isomorphic-dompurify"

/**
 * Escape regex special characters to prevent ReDoS and ensure literal matching.
 * @example escapeRegex("a.b*c") → "a\\.b\\*c"
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * HTML-escape user-supplied string trước khi nhúng vào notification HTML
 * (notification.content render bằng dangerouslySetInnerHTML).
 *
 * Chuyển: & < > " ' / → entities. Trả "" nếu input null/undefined.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return ""
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#47;")
}

/**
 * Validate URL để dùng cho client-side redirect (window.location.href).
 * Chỉ chấp nhận:
 *   - Relative path bắt đầu bằng "/" (ví dụ "/customer/deposit")
 *   - URL absolute cùng origin với window.location
 *
 * Reject: javascript:, data:, tel:, mailto:, domain ngoài.
 * Trả "/dashboard" (an toàn fallback) nếu invalid.
 */
export function safeRedirectUrl(input: unknown): string {
  const FALLBACK = "/dashboard"
  if (typeof input !== "string" || !input) return FALLBACK
  const url = input.trim()
  if (!url || url.length > 2000) return FALLBACK
  // Relative path: phải start "/" + không "//" (protocol-relative attack).
  if (url.startsWith("/") && !url.startsWith("//")) return url
  // Absolute: phải http(s) + cùng origin (chỉ check ở client).
  try {
    if (typeof window === "undefined") return FALLBACK
    const parsed = new URL(url, window.location.origin)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return FALLBACK
    if (parsed.origin !== window.location.origin) return FALLBACK
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return FALLBACK
  }
}

/**
 * Sanitize HTML đến từ admin (CKEditor) trước khi render bằng
 * `dangerouslySetInnerHTML`. Chặn `<script>`, `<iframe>` cross-origin,
 * `on*` events, `javascript:` URLs.
 *
 * Dùng allowlist của DOMPurify (mặc định an toàn) + extend image/link.
 * Empty string nếu input null/undefined.
 *
 * Áp dụng cho: notification.content, blog.content, product.detail,
 * static-page.content, logo.content, service.description.
 */
export function sanitizeRichHtml(input: unknown): string {
  if (input === null || input === undefined) return ""
  const raw = String(input)
  if (!raw) return ""
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      "p", "br", "hr", "div", "span",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "a", "img",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td",
      "figure", "figcaption", "video", "source",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "title", "alt",
      "src", "width", "height", "loading", "decoding", "referrerpolicy",
      "class", "style", "id", "name",
      "colspan", "rowspan",
      "controls", "poster",
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onchange", "onsubmit"],
    ALLOW_DATA_ATTR: false,
  })
}

/**
 * Sanitize user input before passing to MongoDB query.
 * Rejects keys starting with "$" (operator injection) or containing "."
 * (path traversal in nested fields).
 *
 * Recursively walks objects/arrays. Throws Error on suspicious input.
 */
export function sanitizeMongoInput<T>(input: T): T {
  if (input === null || input === undefined) return input
  if (typeof input !== "object") return input

  if (Array.isArray(input)) {
    for (const item of input) {
      sanitizeMongoInput(item)
    }
    return input
  }

  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (key.startsWith("$") || key.includes(".")) {
      throw new Error(`Invalid field name: "${key}"`)
    }
    sanitizeMongoInput((input as Record<string, unknown>)[key])
  }
  return input
}

// ─── Reusable Zod schemas ─────────────────────────────────────────────────────

/** MongoDB ObjectId validator (24 hex chars). */
export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "ID không hợp lệ")

/** Trimmed non-empty string with max length 255. */
export const safeString = (max = 255) =>
  z.string().trim().min(1).max(max)

/** Pagination input — page ≥ 1, limit 1..MAX. */
export const paginationSchema = (maxLimit = 50) =>
  z.object({
    page: z.number().int().min(1).max(10000).default(1),
    limit: z.number().int().min(1).max(maxLimit).default(10),
  })

/** Search keyword — escapes special regex chars, max 100 chars. */
export const searchSchema = z
  .string()
  .max(100)
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

/** Sort direction. */
export const sortDirSchema = z.enum(["asc", "desc"]).default("desc")
