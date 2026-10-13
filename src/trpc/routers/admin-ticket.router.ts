import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { composeKey, consumeRateLimit, mutationLimiter, readLimiter } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  closeTicket,
  getTicketById,
  listTickets,
  sendTicketMessage,
  getTicketCreateGuideConfig,
  updateTicketCreateGuideConfig,
} from "@/services/ticket.service"

const subjectSchema = z.enum(["deposit", "account", "order", "other"])
const statusSchema = z.enum(["open", "pending", "replied", "closed"])
const objectIdSchema = zObjectId

const listInput = z.object({
  page: z.number().int().min(1).max(10_000).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  subject: subjectSchema.optional(),
  status: statusSchema.optional(),
}).strict()

const guideConfigInput = z.object({
  noteHtml: z.string().max(100_000),
  processHtml: z.string().max(100_000),
}).strict()

export const adminTicketRouter = createTRPCRouter({
  getCreateGuideConfig: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.ticket.guide", String(ctx.user._id)), "admin.ticket.guide")
    await connectDB()
    return await getTicketCreateGuideConfig()
  }),

  updateCreateGuideConfig: adminProcedure.input(guideConfigInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.ticket.guide.update", String(ctx.user._id)), "admin.ticket.guide.update")
    await connectDB()
    const result = await updateTicketCreateGuideConfig(input)
    insertLog({ userId: ctx.user._id, action: "Cập nhật hướng dẫn tạo ticket", ip: ctx.ip }).catch(() => {})
    return result
  }),

  list: adminProcedure.input(listInput).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.ticket.list", String(ctx.user._id)), "admin.ticket.list")
    await connectDB()
    return await listTickets({ ...input, isAdmin: true })
  }),

  getById: adminProcedure.input(z.object({ id: objectIdSchema }).strict()).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.ticket.detail", String(ctx.user._id)), "admin.ticket.detail")
    await connectDB()
    return await getTicketById(ctx.user._id, input.id, true)
  }),

  reply: adminProcedure.input(z.object({
    ticketId: objectIdSchema,
    content: z.string().trim().min(1).max(2000),
  }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.ticket.reply", String(ctx.user._id)), "admin.ticket.reply")
    await connectDB()
    const result = await sendTicketMessage({
      userId: ctx.user._id,
      username: ctx.user.username || "Admin",
      ticketId: input.ticketId,
      content: input.content,
      isAdmin: true,
    })
    insertLog({ userId: ctx.user._id, action: `Admin trả lời ticket ${input.ticketId}`, ip: ctx.ip }).catch(() => {})

    // Notify ticket owner (mail + tele user) — best-effort
    if (result.ticketOwnerId) {
      void import("@/services/notify.service").then((m) =>
        m.notifyTicketReply({
          userId: result.ticketOwnerId,
          ticketId: result.ticketCode || input.ticketId,
          ticketTitle: result.ticketTitle || "",
          message: input.content,
        })
      )
    }

    return result
  }),

  close: adminProcedure.input(z.object({ ticketId: objectIdSchema }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.ticket.close", String(ctx.user._id)), "admin.ticket.close")
    await connectDB()
    const result = await closeTicket(ctx.user._id, input.ticketId, true)
    insertLog({ userId: ctx.user._id, action: `Admin đóng ticket ${input.ticketId}`, ip: ctx.ip }).catch(() => {})
    return result
  }),
})
