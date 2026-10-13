import { z } from "zod"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import { listSeoEntries, saveSeoEntry } from "@/services/admin-seo.service"

const saveInput = z.object({
  key: z.string().trim().min(1).max(60),
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  ogImage: z.string().max(500).nullable().optional(),
}).strict()

export const adminSeoRouter = createTRPCRouter({
  list: adminProcedure.query(async () => {
    await connectDB()
    return await listSeoEntries()
  }),

  save: adminProcedure.input(saveInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.seo.save", String(ctx.user._id)), "saveSeo")
    await connectDB()
    const result = await saveSeoEntry(input)
    insertLog({ userId: ctx.user._id, action: `Cập nhật SEO trang "${input.key}"`, ip: ctx.ip }).catch(() => {})
    return result
  }),
})
