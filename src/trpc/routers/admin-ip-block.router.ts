import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { readLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import {
  addBlock,
  removeBlock,
  removeBlocks,
  listBlocks,
  isValidIP,
  normalizeIP,
} from "@/services/blocked-ip.service"
import { BLOCK_SOURCES } from "@/models/blocked-ip.model"

const sourceEnum = z.enum(BLOCK_SOURCES)

const listInput = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    keyword: z.string().max(100).optional(),
    source: z.union([sourceEnum, z.literal("all")]).optional(),
    status: z.enum(["active", "expired", "all"]).optional(),
  })
  .strict()

const addInput = z
  .object({
    ip: z.string().min(1).max(64),
    reason: z.string().max(500).optional(),
    source: sourceEnum.optional(),
    ttlMs: z.number().int().min(0).max(365 * 24 * 60 * 60 * 1000).nullable().optional(),
  })
  .strict()

export const adminIpBlockRouter = createTRPCRouter({
  /** List blocks với pagination + stats. */
  list: adminProcedure.input(listInput).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.ipblock.list", String(ctx.user._id)), "ipblock.list")
    await connectDB()
    return await listBlocks(input)
  }),

  /** Thêm IP vào blocklist. */
  add: adminProcedure.input(addInput).mutation(async ({ ctx, input }) => {
    if (!isValidIP(input.ip)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "IP không hợp lệ" })
    }
    return await addBlock({
      ip: normalizeIP(input.ip),
      reason: input.reason?.trim() || null,
      source: input.source ?? "manual",
      ttlMs: input.ttlMs ?? null,
      createdBy: ctx.user._id,
    })
  }),

  /** Xoá 1 IP. */
  remove: adminProcedure
    .input(z.object({ ip: z.string().min(1).max(64) }).strict())
    .mutation(async ({ input }) => {
      await removeBlock(input.ip)
      return { success: true }
    }),

  /** Xoá nhiều IP. */
  removeBulk: adminProcedure
    .input(z.object({ ips: z.array(z.string().min(1).max(64)).min(1).max(1000) }).strict())
    .mutation(async ({ input }) => {
      const deleted = await removeBlocks(input.ips)
      return { deleted }
    }),
})
