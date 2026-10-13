/**
 * spaceship-whois.service — port `ssWhoisCheck` từ ajaxs.
 *
 * Kiểm tra domain còn trống không trước khi mua qua Spaceship.
 * - `.vn` → API inet.vn
 * - TLD quốc tế → WHOIS socket port 43
 *
 * Trả: 'free' | 'registered' | 'unknown' (timeout/lỗi mạng).
 */
import net from "node:net"

const TLD_WHOIS_SERVERS: Record<string, string> = {
  com: "whois.verisign-grs.com",
  net: "whois.verisign-grs.com",
  org: "whois.pir.org",
  info: "whois.afilias.net",
  biz: "whois.biz",
  xyz: "whois.nic.xyz",
  top: "whois.nic.top",
  io: "whois.nic.io",
}

export type WhoisResult = "free" | "registered" | "unknown"

/**
 * Whois-check cho domain `.vn` qua API inet.vn (giống PHP).
 * Best-effort: lỗi network → trả 'free' để không chặn user; PHP làm vậy.
 */
async function checkVnWhois(domain: string): Promise<WhoisResult> {
  const url = `https://whois.inet.vn/api/whois/domainspecify/domain?domain=${encodeURIComponent(domain)}`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    }).finally(() => clearTimeout(timer))
    if (!res.ok) return "free"
    const json = (await res.json()) as Record<string, unknown>
    if (json.code === undefined) return "free"
    const msg = String(json.message || "").toLowerCase()
    if (json.code === "0" && msg.includes("đã được đăng ký")) return "registered"
    if (json.registrar || json.creationDate) return "registered"
    return "free"
  } catch {
    return "free"
  }
}

/** Whois-check qua TCP socket port 43 cho TLD quốc tế. */
function checkSocketWhois(domain: string): Promise<WhoisResult> {
  const tld = domain.toLowerCase().split(".").pop() || ""
  const server = TLD_WHOIS_SERVERS[tld] ?? "whois.verisign-grs.com"

  return new Promise((resolve) => {
    let response = ""
    const socket = net.createConnection({ host: server, port: 43 })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve("unknown")
    }, 10_000)

    socket.setEncoding("utf8")
    socket.on("connect", () => socket.write(`${domain}\r\n`))
    socket.on("data", (chunk) => {
      response += chunk
    })
    socket.on("end", () => {
      clearTimeout(timer)
      const lower = response.toLowerCase()
      if (lower.includes("no match for") || lower.includes("not found")) return resolve("free")
      if (lower.includes("status: available")) return resolve("free")
      if (response.trim().length === 0) return resolve("unknown")
      resolve("registered")
    })
    socket.on("error", () => {
      clearTimeout(timer)
      resolve("unknown")
    })
  })
}

/**
 * Kiểm tra trạng thái whois của domain (port `ssWhoisCheck`).
 * - `free` → có thể mua
 * - `registered` → đã có chủ, không nên mua
 * - `unknown` → server whois timeout, nên thử lại sau
 */
export async function ssWhoisCheck(domain: string): Promise<WhoisResult> {
  const d = domain.toLowerCase().trim()
  if (/\.vn$/i.test(d)) return checkVnWhois(d)
  return checkSocketWhois(d)
}
