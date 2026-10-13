/**
 * Realtime emit helper — dùng từ service layer (đúng MVC).
 *
 * Socket.IO chạy chung process (custom server), instance `io` lưu trên
 * globalThis.__socketIO bởi src/socket/io.ts. File này KHÔNG import socket.io
 * trực tiếp để an toàn với bundle Next.
 *
 * Thiết kế (revise):
 *  - #6 Namespace-aware: user/notification/deposit → /customer; admin → /admin;
 *    ticket → CẢ HAI (owner ở /customer, admin ở /admin).
 *  - #7 Payload tối thiểu: chỉ truyền field cần thiết, KHÔNG emit raw entity DB.
 *  - #8 ACK + timeout cho event quan trọng (emitToUserWithAck).
 *  - #11 KHÔNG fail-soft im lặng: io chưa ready → log warning (throttle).
 */
import { logger } from "@/lib/logger"

type SocketServer = {
  of: (ns: string) => {
    to: (room: string) => {
      emit: (event: string, data: unknown) => void
      timeout: (ms: number) => { emit: (event: string, data: unknown, cb: (err: unknown, res: unknown) => void) => void }
    }
  }
}

// ─── Throttle log "io not ready" (tránh bão log lúc build/dev/chưa boot) ───
const lastWarnAt = new Map<string, number>()
const WARN_THROTTLE_MS = 10_000

function warnNotReady(event: string, room: string): void {
  const key = `${event}:${room}`
  const now = Date.now()
  const last = lastWarnAt.get(key) || 0
  if (now - last < WARN_THROTTLE_MS) return
  lastWarnAt.set(key, now)
  // #11 Không im lặng — log warning để biết emit bị rớt.
  logger.warn("realtime emit skipped: io not ready", { module: "realtime.emit", event, room })
}

function getIO(): SocketServer | null {
  return ((globalThis as any).__socketIO as SocketServer) || null
}

// ─── Customer namespace emitters ────────────────────────────────────────────

/** Emit tới room cá nhân user (balance, deposit, invoice, order, notification).
 *  Phát ở CẢ /customer và /admin — user có thể đang ở vùng nào cũng nhận được. */
export function emitToUser(userId: string | { toString(): string }, event: string, data: unknown): void {
  const room = `user_${String(userId)}`
  const io = getIO()
  if (!io || !userId) return warnNotReady(event, room)
  try {
    io.of("/customer").to(room).emit(event, data)
    io.of("/admin").to(room).emit(event, data)
  } catch (err) {
    logger.error("realtime emitToUser failed", { module: "realtime.emit", event, room, detail: err instanceof Error ? err.message : String(err) })
  }
}

/**
 * #8 Emit tới 1 user kèm ACK + timeout (event quan trọng: deposit/invoice/ticket reply).
 * Quá timeout mà client chưa ack → log warning (KHÔNG retry vô hạn để tránh bão).
 */
export function emitToUserWithAck(
  userId: string | { toString(): string },
  event: string,
  data: unknown,
  opts: { timeoutMs?: number } = {}
): void {
  const room = `user_${String(userId)}`
  const io = getIO()
  if (!io || !userId) return warnNotReady(event, room)
  const timeoutMs = opts.timeoutMs ?? 5_000
  const onAck = (err: unknown) => {
    if (err) logger.warn("realtime ack timeout", { module: "realtime.emit", event, room, timeoutMs })
  }
  try {
    io.of("/customer").to(room).timeout(timeoutMs).emit(event, data, onAck)
    io.of("/admin").to(room).timeout(timeoutMs).emit(event, data, onAck)
  } catch (err) {
    logger.error("realtime emitToUserWithAck failed", { module: "realtime.emit", event, room, detail: err instanceof Error ? err.message : String(err) })
  }
}

// ─── Ticket (cả 2 namespace: owner ở /customer, admin ở /admin) ──────────────

/** Emit tới room 1 ticket — phát ở CẢ /customer và /admin. */
export function emitToTicket(ticketId: string | { toString(): string }, event: string, data: unknown): void {
  const room = `ticket_${String(ticketId)}`
  const io = getIO()
  if (!io || !ticketId) return warnNotReady(event, room)
  try {
    io.of("/customer").to(room).emit(event, data)
    io.of("/admin").to(room).emit(event, data)
  } catch (err) {
    logger.error("realtime emitToTicket failed", { module: "realtime.emit", event, room, detail: err instanceof Error ? err.message : String(err) })
  }
}

// ─── Admin namespace emitter ─────────────────────────────────────────────────

/** Emit tới tất cả admin (đơn/nạp/ticket mới). */
export function emitToAdmins(event: string, data: unknown): void {
  const io = getIO()
  if (!io) return warnNotReady(event, "admin")
  try {
    io.of("/admin").to("admin").emit(event, data)
  } catch (err) {
    logger.error("realtime emitToAdmins failed", { module: "realtime.emit", event, room: "admin", detail: err instanceof Error ? err.message : String(err) })
  }
}

/** Alias backward-compat (tên cũ emitToAdmin). */
export const emitToAdmin = emitToAdmins
