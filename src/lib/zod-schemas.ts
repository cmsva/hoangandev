/**
 * Shared Zod schemas — chuẩn hóa input validation toàn project.
 *
 * Mục tiêu:
 *  - Loại bỏ `z.string()` thô (cho admin id) — chống ObjectId injection.
 *  - Search term sanitize trước (escape regex metachar).
 *  - URL/slug có shape rõ ràng.
 *
 * Pattern dùng:
 *   import { zObjectId, zSearchTerm, zSlug } from "@/lib/zod-schemas"
 *   z.object({ id: zObjectId, q: zSearchTerm.optional() }).strict()
 */
import { z } from "zod"

/** ObjectId hex 24 ký tự, anchored — không ReDoS. */
export const zObjectId = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "ID không hợp lệ")

/** Mảng ObjectId (vd bulk delete), max 500 để tránh DoS. */
export const zObjectIdArray = z.array(zObjectId).min(1).max(500)

/** Search keyword — max 200 char, trim. Caller phải `escapeRegex`. */
export const zSearchTerm = z
  .string()
  .trim()
  .max(200, "Từ khóa quá dài")

/** Slug — kebab-case, max 200. */
export const zSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9-]+$/, "Slug chỉ chứa chữ thường, số và dấu gạch nối")

/** URL http/https only, max 2048. */
export const zUrlHttp = z
  .string()
  .trim()
  .url("URL không hợp lệ")
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), "URL phải bắt đầu bằng http:// hoặc https://")

/** Email — max 255, lowercase. */
export const zEmail = z.string().trim().toLowerCase().email().max(255)

/** Pagination chuẩn cho mọi list — page ≥ 1, limit 1-200. */
export const zPagination = z.object({
  page: z.number().int().min(1).max(10_000).default(1),
  limit: z.number().int().min(1).max(200).default(20),
})

/** Số tiền VND không âm, max 10 tỷ (chống overflow JS Number). */
export const zVndAmount = z
  .number()
  .min(0, "Số tiền không hợp lệ")
  .max(10_000_000_000, "Số tiền vượt quá giới hạn")

/** Helper: escape regex metacharacters từ user input trước khi dùng `$regex`. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
