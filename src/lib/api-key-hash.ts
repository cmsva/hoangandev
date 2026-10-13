/**
 * API key generator + verifier.
 *
 * Format key: hex 64 ký tự (256 bits entropy) — không có prefix `vk_live`.
 * Lưu DB:
 *  - `prefix` = 8 ký tự đầu (plain, indexed cho lookup)
 *  - `keyHash` = SHA-256(fullKey) hex
 *
 * Verify constant-time so `crypto.timingSafeEqual` chống timing attack.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export interface GeneratedApiKey {
  /** Key gốc — chỉ trả về client 1 lần khi tạo */
  apiKey: string
  /** 8 ký tự đầu — lưu DB plain */
  prefix: string
  /** SHA-256 hex — lưu DB */
  keyHash: string
}

/** Generate api-key 64 hex chars + return prefix + hash. */
export function generateApiKey(): GeneratedApiKey {
  const apiKey = randomBytes(32).toString("hex") // 64 hex chars
  const prefix = apiKey.slice(0, 8)
  const keyHash = sha256Hex(apiKey)
  return { apiKey, prefix, keyHash }
}

/** SHA-256 hex digest. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

/** Constant-time hex string compare. */
export function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
  } catch {
    return false
  }
}

/** Verify input api-key match a stored hash + prefix. */
export function verifyApiKeyMatch(
  inputKey: string,
  storedPrefix: string,
  storedHash: string
): boolean {
  if (typeof inputKey !== "string" || inputKey.length !== 64) return false
  if (inputKey.slice(0, 8) !== storedPrefix) return false
  return timingSafeHexEqual(sha256Hex(inputKey), storedHash)
}
