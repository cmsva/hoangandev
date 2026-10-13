/**
 * Agency API Key router — quản lý api-key của user trong /document-api.
 *
 * Mọi procedure đều `protectedProcedure` (yêu cầu đăng nhập).
 *
 * Pattern: thin layer — gọi service, ghi audit nhẹ qua log.service.
 */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, protectedProcedure } from "../init"
import { connectDB } from "@/lib/db"
import {
  createApiKey,
  listMyApiKeys,
  updateApiKey,
  revokeApiKey,
  rotateApiKey,
  listAuditLogs,
  countRequestsInRange,
  invalidateKeyCache,
} from "@/services/api-key.service"
import { API_KEY_SCOPES } from "@/models/api-key.model"
import { consumeRateLimit, mutationLimiter, composeKey } from "@/lib/rate-limit"

const scopeSchema = z.union([z.literal("*"), z.enum(API_KEY_SCOPES)])

const ipWhitelistSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(50)
  .optional()
  .default([])

export const apiKeyRouter = createTRPCRouter({
  /** List API keys của user */
  list: protectedProcedure.query(async ({ ctx }) => {
    await connectDB()
    return listMyApiKeys(ctx.user._id)
  }),

  /** Tạo API key mới — trả raw key 1 lần */
  create: protectedProcedure
    .input(
      z
        .object({
          name: z.string().trim().min(1).max(100),
          scopes: z.array(scopeSchema).min(1).default(["*"]),
          ipWhitelist: ipWhitelistSchema,
          rateLimitPerMin: z.number().int().min(1).max(1000).default(60),
          expiresAt: z.coerce.date().nullable().optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("apiKey.create", String(ctx.user._id)),
        "create"
      )
      await connectDB()
      return createApiKey({
        userId: ctx.user._id,
        ...input,
        expiresAt: input.expiresAt ?? null,
      })
    }),

  /** Update key — bất kỳ field nào */
  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string().regex(/^[a-f0-9]{24}$/i),
          name: z.string().trim().min(1).max(100).optional(),
          scopes: z.array(scopeSchema).min(1).optional(),
          ipWhitelist: ipWhitelistSchema,
          rateLimitPerMin: z.number().int().min(1).max(1000).optional(),
          status: z.enum(["active", "disabled"]).optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("apiKey.update", String(ctx.user._id)),
        "update"
      )
      await connectDB()
      const { id, ...patch } = input
      await updateApiKey(ctx.user._id, id, patch)
      invalidateKeyCache(id)
    }),

  /** Revoke key (soft) */
  revoke: protectedProcedure
    .input(z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("apiKey.revoke", String(ctx.user._id)),
        "revoke"
      )
      await connectDB()
      await revokeApiKey(ctx.user._id, input.id)
      invalidateKeyCache(input.id)
    }),

  /** Rotate key — keep id but new secret */
  rotate: protectedProcedure
    .input(z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("apiKey.rotate", String(ctx.user._id)),
        "rotate"
      )
      await connectDB()
      const result = await rotateApiKey(ctx.user._id, input.id)
      invalidateKeyCache(input.id)
      return result
    }),

  /** List audit logs */
  auditLogs: protectedProcedure
    .input(
      z
        .object({
          apiKeyId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
          limit: z.number().int().min(1).max(500).default(100),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await connectDB()
      return listAuditLogs(ctx.user._id, input.apiKeyId, input.limit)
    }),

  /** Stats usage 30d/24h */
  usageStats: protectedProcedure.query(async ({ ctx }) => {
    await connectDB()
    const since30d = new Date(Date.now() - 30 * 86400_000)
    const since24h = new Date(Date.now() - 86400_000)
    const [d30, d24] = await Promise.all([
      countRequestsInRange(ctx.user._id, since30d),
      countRequestsInRange(ctx.user._id, since24h),
    ])
    return { last30d: d30, last24h: d24 }
  }),

  /** Public: list available scopes — cho UI build picker */
  availableScopes: protectedProcedure.query(() => {
    return ["*", ...API_KEY_SCOPES]
  }),
})
