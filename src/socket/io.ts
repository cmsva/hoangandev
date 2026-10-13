/**
 * Socket.IO server — tách namespace /customer + /admin, hardening đầy đủ.
 *
 * Thiết kế (theo yêu cầu revise):
 *  - #6 Hai namespace riêng: `/customer` (user thường) và `/admin` (chỉ admin).
 *  - #1 Auto-join room sau khi verify JWT trong middleware — client KHÔNG emit join_user.
 *  - #2 Event rate-limit 150/s/IP (vượt → disconnect). Connection 20/5s/IP.
 *  - #3 pingInterval 25s + pingTimeout 60s (giảm disconnect giả qua Cloudflare/proxy).
 *  - #4 join_ticket: verify quyền sở hữu Ở SERVER qua DB (không tin client).
 *  - #5 Cleanup mọi state phụ khi disconnect (tránh memory leak).
 *  - #10 Logging: connect / disconnect / auth-fail / join / join-denied / rate-limit / error.
 *
 * Lưu `io` lên globalThis để emit helper (chạy trong bundle Next, cùng process) đọc được.
 *
 * CHỈ dùng relative import + npm package (không alias @/) để tsx resolve được.
 */
import type { Server as HttpServer } from "node:http"
import { Server, type Namespace, type Socket } from "socket.io"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { RateLimiterMemory } from "rate-limiter-flexible"
import { socketLog } from "./logger"

interface SocketUser {
  userId: string
  admin: number
}

const JWT_SECRET = process.env.JWT_SECRET || ""
const TICKET_ID_RE = /^[a-f\d]{24}$/i

/** Parse cookie header thành object. */
function parseCookies(cookieStr: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!cookieStr) return out
  for (const part of cookieStr.split(";")) {
    const idx = part.indexOf("=")
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

/** Lấy IP thật từ proxy headers. */
function getIp(socket: Socket): string {
  const fwd = socket.handshake.headers["x-forwarded-for"]
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim()
  return socket.handshake.address || "unknown"
}

/** Verify JWT cookie → user payload (zero-DB). Null nếu thiếu/sai. */
function verifySocketUser(socket: Socket): SocketUser | null {
  const cookies = parseCookies(socket.handshake.headers.cookie || "")
  const token = cookies.token || (socket.handshake.auth?.token as string | undefined)
  if (!token || !JWT_SECRET) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string; admin?: number }
    if (!payload?.sub) return null
    return { userId: payload.sub, admin: payload.admin || 0 }
  } catch {
    return null
  }
}

/**
 * Verify user sở hữu ticket (#4 — không tin client).
 * Dùng raw collection query (không import model @/) để tsx resolve.
 */
async function userOwnsTicket(userId: string, ticketId: string): Promise<boolean> {
  try {
    const db = mongoose.connection.db
    if (!db) return false
    const doc = await db.collection("tickets").findOne(
      { _id: new mongoose.Types.ObjectId(ticketId), userId: new mongoose.Types.ObjectId(userId) },
      { projection: { _id: 1 } }
    )
    return !!doc
  } catch (err) {
    socketLog.error("ticket ownership check failed", {
      userId,
      ticketId,
      detail: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

export function initSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: process.env.NEXT_PUBLIC_APP_URL || true, credentials: true },
    // #3 Ping config tường minh — giảm disconnect giả khi qua Cloudflare/proxy/mạng yếu.
    pingInterval: 25_000,
    pingTimeout: 60_000,
    maxHttpBufferSize: 1e4, // 10KB — chống RAM exhaustion
    transports: ["websocket", "polling"],
  })

  // ─── Rate limiters (in-memory — đủ cho 1 process) ───
  const connLimiter = new RateLimiterMemory({ keyPrefix: "ws_conn", points: 20, duration: 5 })
  // #2 Event rate-limit nâng 30 → 150/s.
  const eventLimiter = new RateLimiterMemory({ keyPrefix: "ws_event", points: 150, duration: 1 })

  // ─── Connection handshake rate-limit (toàn cục, trước khi vào namespace) ───
  io.engine.use(async (req: any, res: any, next: any) => {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "unknown"
    try {
      await connLimiter.consume(ip)
      next()
    } catch {
      res.writeHead(429, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Too Many Requests" }))
    }
  })

  const customerNs = io.of("/customer")
  const adminNs = io.of("/admin")

  setupCustomerNamespace(customerNs, eventLimiter)
  setupAdminNamespace(adminNs, eventLimiter)

  // Expose cho emit helper (cùng process, khác module-graph).
  ;(globalThis as any).__socketIO = io
  socketLog.connect({ ns: "init", reason: "namespaces /customer + /admin ready" } as any)
  console.log("[socket] Socket.IO initialized — /customer + /admin")
  return io
}

/** Gắn event rate-limit cho 1 socket (#2). Vượt → disconnect + log. */
function attachEventRateLimit(socket: Socket, limiter: RateLimiterMemory, ns: string, ip: string) {
  socket.use(async (_packet, next) => {
    try {
      await limiter.consume(ip)
      next()
    } catch {
      next(new Error("RATE_LIMITED"))
    }
  })
  socket.on("error", (err) => {
    if (err?.message === "RATE_LIMITED") {
      socketLog.rateLimit({ ns, socketId: socket.id, ip, userId: socket.data.user?.userId })
      socket.disconnect(true)
    }
  })
}

// ─── /customer namespace ──────────────────────────────────────────────────
function setupCustomerNamespace(ns: Namespace, eventLimiter: RateLimiterMemory) {
  // #1 Middleware: verify JWT → gắn user. Ẩn danh KHÔNG cho qua (vùng login).
  ns.use((socket, next) => {
    const user = verifySocketUser(socket)
    if (!user) {
      socketLog.authFail({ ns: "/customer", socketId: socket.id, ip: getIp(socket), reason: "no/invalid token" })
      return next(new Error("UNAUTHORIZED"))
    }
    socket.data.user = user
    next()
  })

  ns.on("connection", (socket: Socket) => {
    const ip = getIp(socket)
    const user = socket.data.user as SocketUser
    attachEventRateLimit(socket, eventLimiter, "/customer", ip)

    // #1 Auto-join room cá nhân ngay sau verify — client không cần emit gì.
    socket.join(`user_${user.userId}`)
    socketLog.connect({ ns: "/customer", socketId: socket.id, ip, userId: user.userId })
    socketLog.joinRoom({ ns: "/customer", socketId: socket.id, userId: user.userId, room: `user_${user.userId}` })

    // #4 join_ticket: verify quyền sở hữu ở SERVER (không tin client).
    socket.on("join_ticket", async (ticketId: unknown) => {
      if (typeof ticketId !== "string" || !TICKET_ID_RE.test(ticketId)) return
      const ok = await userOwnsTicket(user.userId, ticketId)
      if (!ok) {
        socketLog.joinDenied({ ns: "/customer", socketId: socket.id, userId: user.userId, room: `ticket_${ticketId}`, reason: "not owner" })
        return
      }
      socket.join(`ticket_${ticketId}`)
      socketLog.joinRoom({ ns: "/customer", socketId: socket.id, userId: user.userId, room: `ticket_${ticketId}` })
    })

    socket.on("leave_ticket", (ticketId: unknown) => {
      if (typeof ticketId !== "string" || !TICKET_ID_RE.test(ticketId)) return
      socket.leave(`ticket_${ticketId}`)
    })

    // #5 Cleanup khi disconnect — socket.io tự rời room; log để theo dõi.
    socket.on("disconnect", (reason) => {
      socketLog.disconnect({ ns: "/customer", socketId: socket.id, ip, userId: user.userId, reason })
    })
  })
}

// ─── /admin namespace ───────────────────────────────────────────────────────
function setupAdminNamespace(ns: Namespace, eventLimiter: RateLimiterMemory) {
  // Middleware: verify JWT + bắt buộc admin === 1 (chặn user thường vào ns admin).
  ns.use((socket, next) => {
    const user = verifySocketUser(socket)
    if (!user) {
      socketLog.authFail({ ns: "/admin", socketId: socket.id, ip: getIp(socket), reason: "no/invalid token" })
      return next(new Error("UNAUTHORIZED"))
    }
    if (user.admin !== 1) {
      socketLog.authFail({ ns: "/admin", socketId: socket.id, ip: getIp(socket), userId: user.userId, reason: "not admin" })
      return next(new Error("FORBIDDEN"))
    }
    socket.data.user = user
    next()
  })

  ns.on("connection", (socket: Socket) => {
    const ip = getIp(socket)
    const user = socket.data.user as SocketUser
    attachEventRateLimit(socket, eventLimiter, "/admin", ip)

    // Auto-join: room admin chung + room cá nhân (admin cũng là 1 user).
    socket.join("admin")
    socket.join(`user_${user.userId}`)
    socketLog.connect({ ns: "/admin", socketId: socket.id, ip, userId: user.userId })
    socketLog.joinRoom({ ns: "/admin", socketId: socket.id, userId: user.userId, room: "admin" })

    // Admin được join ticket bất kỳ (không cần check ownership) — vẫn validate format.
    socket.on("join_ticket", (ticketId: unknown) => {
      if (typeof ticketId !== "string" || !TICKET_ID_RE.test(ticketId)) return
      socket.join(`ticket_${ticketId}`)
      socketLog.joinRoom({ ns: "/admin", socketId: socket.id, userId: user.userId, room: `ticket_${ticketId}` })
    })

    socket.on("leave_ticket", (ticketId: unknown) => {
      if (typeof ticketId !== "string" || !TICKET_ID_RE.test(ticketId)) return
      socket.leave(`ticket_${ticketId}`)
    })

    socket.on("disconnect", (reason) => {
      socketLog.disconnect({ ns: "/admin", socketId: socket.id, ip, userId: user.userId, reason })
    })
  })
}
