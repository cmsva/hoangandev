import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import { cookies } from "next/headers"
import { verifyToken, getCurrentUser } from "@/services/auth.service"
import { assertNotMaintenance } from "@/lib/maintenance-guard"
import { User } from "@/models/user.model"
import { logger } from "@/lib/logger"

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value ?? null

  let userId: string | null = null
  if (token) {
    const payload = verifyToken(token)
    if (payload) userId = payload.sub
  }

  // Trust proxy chain CF/Vercel.
  const headers = opts.headers
  const ip =
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null

  return { userId, headers, ip }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({ transformer: superjson })

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory
export const baseProcedure = t.procedure

/** Slow-query log — bỏ qua < 1500ms để tránh nhiễu cold-start. */
const timingMiddleware = t.middleware(async ({ next, path, type }) => {
  const start = Date.now()
  const result = await next()
  const durationMs = Date.now() - start
  if (durationMs > 1500) {
    logger.warn("slow procedure", { module: "trpc", path, type, durationMs })
  }
  return result
})

export const loggedProcedure = baseProcedure.use(timingMiddleware)

// ─── lastSeen throttle: mỗi user update tối đa 1 lần / 60s ────────────────
const lastSeenThrottle = new Map<string, number>()
const LASTSEEN_THROTTLE_MS = 60_000

function bumpLastSeen(userId: string) {
  const now = Date.now()
  const last = lastSeenThrottle.get(userId)
  if (last && now - last < LASTSEEN_THROTTLE_MS) return

  lastSeenThrottle.set(userId, now)

  // Cleanup khi map quá lớn (cap memory).
  if (lastSeenThrottle.size > 10_000) {
    const cutoff = now - LASTSEEN_THROTTLE_MS
    for (const [k, t] of lastSeenThrottle) {
      if (t < cutoff) lastSeenThrottle.delete(k)
    }
  }

  // Fire-and-forget — không block request.
  User.updateOne({ _id: userId }, { $set: { lastSeen: new Date(now) } })
    .exec()
    .catch(() => {})
}

/** Protected procedure — requires authenticated user */
export const protectedProcedure = loggedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập" })
  }

  const user = await getCurrentUser(ctx.userId)
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Phiên đăng nhập không hợp lệ" })
  }
  if (user.banned === 1) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Tài khoản đã bị khóa" })
  }

  // Maintenance gate — admin được qua.
  await assertNotMaintenance({ isAdmin: user.admin === 1 })

  bumpLastSeen(ctx.userId)

  return next({ ctx: { ...ctx, user } })
})

/** Admin procedure — requires admin role */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.admin !== 1) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Bạn không có quyền truy cập" })
  }
  return next({ ctx })
})
