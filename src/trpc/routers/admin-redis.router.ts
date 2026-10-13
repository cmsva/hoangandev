import { z } from "zod"
import { createTRPCRouter, adminProcedure } from "@/trpc/init"
import {
  getRedisStatus,
  listRedisKeys,
  getRedisKeyDetail,
  deleteRedisKey,
  deleteRedisKeysByPrefix,
  flushAllCache,
} from "@/services/admin-redis.service"
import { resetCacheStats } from "@/lib/cache"

export const adminRedisRouter = createTRPCRouter({
  status: adminProcedure.query(async () => getRedisStatus()),

  listKeys: adminProcedure
    .input(
      z.object({
        pattern: z.string().max(200).optional(),
        cursor: z.string().max(50).optional(),
        count: z.number().int().min(20).max(500).optional(),
      })
    )
    .query(async ({ input }) => listRedisKeys(input)),

  getKey: adminProcedure
    .input(z.object({ key: z.string().min(1).max(500) }))
    .query(async ({ input }) => getRedisKeyDetail(input.key)),

  deleteKey: adminProcedure
    .input(z.object({ key: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => deleteRedisKey(input.key)),

  deletePrefix: adminProcedure
    .input(z.object({ prefix: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => deleteRedisKeysByPrefix(input.prefix)),

  flushAll: adminProcedure.mutation(async () => flushAllCache()),

  resetStats: adminProcedure.mutation(async () => {
    resetCacheStats()
    return { ok: true }
  }),
})
