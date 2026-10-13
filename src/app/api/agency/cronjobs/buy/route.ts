/**
 * POST /api/agency/cronjobs/buy
 *
 * Tạo cronjob mới cho đối tác — trừ tiền vào số dư của tài khoản API.
 *
 * Body:
 *   {
 *     serverId, url,
 *     method: "GET" | "POST",
 *     intervalSeconds: 30..31536000,
 *     month: 1..24,
 *     headers?: string (JSON encoded),
 *     body?: string
 *   }
 */
import type { NextRequest } from "next/server"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { withApiAuth } from "@/lib/api-handler"
import { apiSuccess } from "@/lib/api-response"
import { purchaseCronjob } from "@/services/cronjob.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z
  .object({
    serverId: z.string().trim().regex(/^[a-f0-9]{24}$/i, "serverId không hợp lệ"),
    url: z.string().url().max(2048),
    method: z.enum(["GET", "POST"]).default("GET"),
    intervalSeconds: z
      .number({ message: "Số giây không hợp lệ" })
      .int("Số giây phải là số nguyên")
      .min(1, "Số giây phải lớn hơn 0")
      .max(31_536_000, "Vòng lặp tối đa 1 năm"),
    month: z.number().int().min(1).max(24),
    headers: z.string().max(8192).optional().nullable(),
    body: z.string().max(16_384).optional().nullable(),
  })
  .strict()

export const POST = withApiAuth(
  async (req: NextRequest, ctx) => {
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Body phải là JSON" })
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: parsed.error.issues[0]?.message ?? "Body không hợp lệ",
      })
    }
    const result = await purchaseCronjob({
      userId: ctx.userId,
      ...parsed.data,
    })
    return apiSuccess(result, {
      message: "Tạo cronjob thành công",
      requestId: ctx.requestId,
    })
  },
  { scope: "cronjobs:write" }
)
