import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { createTRPCContext } from "@/trpc/init"
import { appRouter } from "@/trpc/routers/_app"
import { TRPCError } from "@trpc/server"
import { logger } from "@/lib/logger"
import { readLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"

/**
 * Mark route as Node.js runtime — cần cho Mongoose, bcryptjs, jsonwebtoken.
 * (Edge runtime không hỗ trợ.)
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const handler = async (req: Request) => {
  // Outer-layer rate limit theo IP — chống flood ngay từ HTTP edge
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"

  try {
    await consumeRateLimit(readLimiter, composeKey("trpc:edge", ip), "trpc-edge")
  } catch {
    return new Response(
      JSON.stringify({ error: { message: "Quá nhiều yêu cầu. Thử lại sau." } }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
    )
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError({ error, path, type }) {
      // Log các lỗi không phải client-side
      if (error.code === "INTERNAL_SERVER_ERROR") {
        logger.error("tRPC internal error", error, { module: "trpc", path, type })
      } else if (error.code !== "UNAUTHORIZED" && error.code !== "FORBIDDEN" && error.code !== "BAD_REQUEST" && error.code !== "NOT_FOUND") {
        logger.warn("tRPC error", { module: "trpc", path, type, code: error.code, message: error.message })
      }
    },
    // Strip stack traces from production responses
    responseMeta() {
      return {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    },
  })
}

export { handler as GET, handler as POST }
