/**
 * AES-256-GCM encryption cho dữ liệu nhạy cảm at-rest.
 *
 * Pattern:
 *  - Mỗi field 1 IV ngẫu nhiên (12 bytes).
 *  - Output: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 *  - Key từ env `ENCRYPTION_KEY` (32 bytes hex / base64 / utf8).
 *
 * Hardening:
 *  - `decryptValue` KHÔNG throw — return null khi sai key/tampering/format.
 *    Mọi caller xử lý null thay vì 500 crash app.
 *  - `encryptValue` throw 1 lần duy nhất nếu chưa set key (config error).
 *  - `isValidObjectId` re-export — caller dùng tránh ReDoS từ user input.
 */
import crypto from "crypto"
import { logger } from "@/lib/logger"

const ALGO = "aes-256-gcm"
const IV_LEN = 12
const AUTH_TAG_LEN = 16

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY env not set. Generate: openssl rand -hex 32"
    )
  }
  let key: Buffer
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    key = Buffer.from(raw, "hex")
  } else if (/^[A-Za-z0-9+/=]{40,48}$/.test(raw)) {
    key = Buffer.from(raw, "base64")
  } else {
    key = Buffer.from(raw, "utf8")
  }
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be 32 bytes (got ${key.length}). Use: openssl rand -hex 32`
    )
  }
  cachedKey = key
  return key
}

/**
 * Encrypt plaintext. Trả `iv:tag:ciphertext` (hex). Null/empty input → null.
 * Throw chỉ khi ENCRYPTION_KEY chưa set (config error, không phải runtime data).
 */
export function encryptValue(plain: string | null | undefined): string | null {
  if (!plain) return null
  const key = getKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`
}

/**
 * Decrypt giá trị encrypt bằng `encryptValue`.
 * Trả null nếu: input rỗng, format sai, IV/tag sai length, key sai, data tampered.
 * KHÔNG throw → caller không crash khi data DB bị hỏng.
 */
export function decryptValue(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null
  try {
    const parts = encrypted.split(":")
    if (parts.length !== 3) return null
    const [ivHex, tagHex, dataHex] = parts
    if (!ivHex || !tagHex || !dataHex) return null
    const iv = Buffer.from(ivHex, "hex")
    const tag = Buffer.from(tagHex, "hex")
    const data = Buffer.from(dataHex, "hex")
    if (iv.length !== IV_LEN || tag.length !== AUTH_TAG_LEN) return null

    const key = getKey()
    const decipher = crypto.createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
  } catch (err) {
    // GCM auth fail là common khi key xoay vòng, rate-limit log.
    logger.warn("decrypt failed", {
      module: "encryption",
      error: (err as Error).message.slice(0, 80),
    })
    return null
  }
}

/**
 * Mask 1 string cho UI (không decrypt). Vd "••••••••" hay "abc••••••••xyz".
 */
export function maskCredential(value: string | null | undefined, visibleChars = 0): string {
  if (!value) return ""
  if (visibleChars > 0 && value.length > visibleChars * 2) {
    return value.slice(0, visibleChars) + "•".repeat(8) + value.slice(-visibleChars)
  }
  return "•".repeat(8)
}

/**
 * Validate ObjectId (24 hex). Dùng trước mọi DB query có user input.
 * Đơn giản, anchored, không ReDoS. Dùng thay regex inline ở mỗi call site.
 */
export function isValidObjectId(s: string | null | undefined): s is string {
  return typeof s === "string" && /^[a-f\d]{24}$/i.test(s)
}
