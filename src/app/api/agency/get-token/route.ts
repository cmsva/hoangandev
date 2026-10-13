/**
 * POST /api/agency/get-token
 *
 * Đổi `api-key` thành JWT 8h (`auth-token`).
 *
 * Idempotent: trong cùng 1 cửa sổ TTL, gọi nhiều lần trả lại cùng token.
 *
 * Response:
 *   { error: 0, "auth-token": "<JWT>", "expires-in": 28800 }
 */
import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { withApiPublic, getClientIp } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { consumeApiTokenLimit } from "@/lib/api-rate-limit"
import { getOrIssueToken } from "@/services/api-key.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const POST = withApiPublic(async (req: NextRequest, requestId) => {
  const ip = getClientIp(req)
  await consumeApiTokenLimit(ip)

  const apiKey = (req.headers.get("api-key") || req.headers.get("x-api-key") || "").trim()
  if (!apiKey) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Thiếu header api-key" })
  }
  const result = await getOrIssueToken({ apiKey, ip })
  return apiSuccess(
    {
      "auth-token": result.token,
      "expires-in": result.expiresIn,
      "expires-at": result.expiresAt.toISOString(),
      "key-prefix": result.prefix,
    },
    { requestId }
  )
})
