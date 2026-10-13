/**
 * IP / CIDR matching helpers — IPv4 only (đủ cho VN).
 *
 * Dùng:
 *   ipMatchesAny("1.2.3.4", ["1.2.3.0/24", "8.8.8.8"]) → true/false
 *
 * Empty whitelist = allow all (caller chịu trách nhiệm gating).
 */

/** Convert "1.2.3.4" → 32-bit unsigned int. Returns -1 if invalid. */
export function ipv4ToInt(ip: string): number {
  const parts = ip.trim().split(".")
  if (parts.length !== 4) return -1
  let result = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 255) return -1
    result = (result << 8) >>> 0
    result = (result | n) >>> 0
  }
  return result
}

/** True khi `ip` thuộc CIDR `cidr`. */
export function ipInCidr(ip: string, cidr: string): boolean {
  if (cidr.includes("/")) {
    const [base, maskStr] = cidr.split("/")
    const mask = Number(maskStr)
    if (!Number.isInteger(mask) || mask < 0 || mask > 32) return false
    const baseInt = ipv4ToInt(base)
    const ipInt = ipv4ToInt(ip)
    if (baseInt < 0 || ipInt < 0) return false
    if (mask === 0) return true
    const maskInt = ((0xffffffff << (32 - mask)) >>> 0) >>> 0
    return (baseInt & maskInt) === (ipInt & maskInt)
  }
  // Literal IP
  const ipInt = ipv4ToInt(ip)
  const baseInt = ipv4ToInt(cidr)
  if (ipInt < 0 || baseInt < 0) return false
  return ipInt === baseInt
}

/** True khi `ip` match bất kỳ entry nào trong list. Empty list = false (caller decides). */
export function ipMatchesAny(ip: string, list: string[]): boolean {
  if (!ip) return false
  for (const entry of list) {
    const trimmed = entry.trim()
    if (!trimmed) continue
    if (ipInCidr(ip, trimmed)) return true
  }
  return false
}

/** Validate format CIDR/IP — dùng khi user submit whitelist. */
export function isValidIpOrCidr(input: string): boolean {
  const value = input.trim()
  if (!value) return false
  if (value.includes("/")) {
    const [base, maskStr] = value.split("/")
    const mask = Number(maskStr)
    if (!Number.isInteger(mask) || mask < 0 || mask > 32) return false
    return ipv4ToInt(base) >= 0
  }
  return ipv4ToInt(value) >= 0
}
