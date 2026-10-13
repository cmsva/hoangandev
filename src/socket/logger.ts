/**
 * Socket logger — wrapper mỏng quanh logger gốc, cố định module="socket".
 *
 * CHỈ import relative (../lib/logger) — KHÔNG dùng alias @/ để tsx resolve được
 * khi chạy server.ts ngoài bundler Next.
 *
 * Mọi log socket nên đi qua đây để dễ filter production:
 *   grep '"module":"socket"'
 */
import { logger } from "../lib/logger"

interface SocketLogCtx {
  ns?: string
  socketId?: string
  ip?: string
  userId?: string
  [key: string]: unknown
}

const base = (ctx?: SocketLogCtx) => ({ module: "socket", ...ctx })

export const socketLog = {
  /** Client kết nối thành công (sau auth). */
  connect: (ctx: SocketLogCtx) => logger.info("ws connect", base(ctx)),

  /** Client ngắt kết nối — kèm reason của socket.io. */
  disconnect: (ctx: SocketLogCtx & { reason?: string }) =>
    logger.info("ws disconnect", base(ctx)),

  /** JWT verify fail / token thiếu / sai namespace quyền. */
  authFail: (ctx: SocketLogCtx & { reason: string }) =>
    logger.warn("ws auth fail", base(ctx)),

  /** Join room thành công. */
  joinRoom: (ctx: SocketLogCtx & { room: string }) =>
    logger.info("ws join room", base(ctx)),

  /** Từ chối join (vd ticket không thuộc sở hữu). */
  joinDenied: (ctx: SocketLogCtx & { room: string; reason: string }) =>
    logger.warn("ws join denied", base(ctx)),

  /** Vượt rate-limit event → sắp disconnect. */
  rateLimit: (ctx: SocketLogCtx) => logger.warn("ws rate limited", base(ctx)),

  /** Lỗi realtime bất kỳ. */
  error: (message: string, ctx?: SocketLogCtx) =>
    logger.error(`ws ${message}`, base(ctx)),
}
