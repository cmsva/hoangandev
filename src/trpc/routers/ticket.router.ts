import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, protectedProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { composeKey, consumeRateLimit, mutationLimiter, readLimiter, strictLimiter } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  closeTicket,
  createTicket,
  getTicketById,
  getTicketStats,
  listTickets,
  sendTicketMessage,
  getTicketCreateGuideConfig,
} from "@/services/ticket.service"

const subjectSchema = z.enum(["deposit", "account", "order", "other"])
const statusSchema = z.enum(["open", "pending", "replied", "closed"])

export const ticketRouter = createTRPCRouter({
  createGuideConfig: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("ticket.createGuide", String(ctx.user._id)), "ticket.createGuide")
    await connectDB()
    return await getTicketCreateGuideConfig()
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("ticket.stats", String(ctx.user._id)), "ticket.stats")
    await connectDB()
    return await getTicketStats(ctx.user._id)
  }),

  list: protectedProcedure.input(z.object({
    page: z.number().int().min(1).max(10_000).default(1),
    limit: z.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).optional(),
    subject: subjectSchema.optional(),
    status: statusSchema.optional(),
  }).strict()).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("ticket.list", String(ctx.user._id)), "ticket.list")
    await connectDB()
    return await listTickets({ userId: ctx.user._id, ...input })
  }),
  getById: protectedProcedure.input(z.object({ id: zObjectId }).strict()).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("ticket.detail", String(ctx.user._id)), "ticket.detail")
    await connectDB()
    return await getTicketById(ctx.user._id, input.id)
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().trim().min(1).max(200),
    subject: subjectSchema,
    content: z.string().trim().min(1).max(2000),
    captchaToken: z.string().trim().max(5000).optional(),
  }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(strictLimiter, composeKey("ticket.create", String(ctx.user._id)), "ticket.create")
    await consumeRateLimit(mutationLimiter, composeKey("ticket.create:ip", ctx.ip), "ticket.create.ip")
    await connectDB()
    const result = await createTicket({ userId: ctx.user._id, username: ctx.user.username || "User", ...input, ip: ctx.ip })
    insertLog({ userId: ctx.user._id, action: `Tạo ticket ${result.id}`, ip: ctx.ip }).catch(() => {})

    // Notify admin (best-effort)
    void import("@/services/notify.service").then((m) =>
      m.notifyTicketNew({
        userId: ctx.user._id as any,
        ticketId: result.id,
        title: input.title,
      })
    )

    return result
  }),

  sendMessage: protectedProcedure.input(z.object({
    ticketId: zObjectId,
    content: z.string().trim().min(1).max(2000),
    image: z.string().trim().max(2_000_000).optional(),
  }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("ticket.message", String(ctx.user._id)), "ticket.message")
    await connectDB()
    return await sendTicketMessage({ userId: ctx.user._id, username: ctx.user.username || "User", ...input })
  }),

  close: protectedProcedure.input(z.object({ ticketId: zObjectId }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("ticket.close", String(ctx.user._id)), "ticket.close")
    await connectDB()
    return await closeTicket(ctx.user._id, input.ticketId)
  }),
})
