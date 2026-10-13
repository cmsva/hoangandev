/**
 * Notification router — user-facing (header bell + page).
 */
import { z } from "zod"
import { zObjectId } from "@/lib/zod-schemas"
import { createTRPCRouter, protectedProcedure } from "../init"
import { connectDB } from "@/lib/db"
import {
  readLimiter,
  mutationLimiter,
  consumeRateLimit,
  composeKey,
} from "@/lib/rate-limit"
import {
  countUnreadForUser,
  listForUser,
  markAllRead,
  markRead,
  removeForUser,
} from "@/services/notification.service"

export const notificationRouter = createTRPCRouter({
  /** Header dropdown — list 20 mới nhất + unread count */
  headerList: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(
      readLimiter,
      composeKey("notif.header", String(ctx.user._id)),
      "notif.header"
    )
    await connectDB()
    return listForUser(ctx.user._id, { page: 1, limit: 15 })
  }),

  /** Trang chi tiết — phân trang */
  list: protectedProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).max(10000).default(1),
          limit: z.number().int().min(1).max(50).default(20),
          onlyUnread: z.boolean().default(false),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(
        readLimiter,
        composeKey("notif.list", String(ctx.user._id)),
        "notif.list"
      )
      await connectDB()
      return listForUser(ctx.user._id, input)
    }),

  /** Chỉ count — gọi nhanh khi badge cần update */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    await connectDB()
    const count = await countUnreadForUser(ctx.user._id)
    return { count }
  }),

  /** Đánh dấu đã đọc 1 hoặc nhiều */
  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(50) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("notif.markRead", String(ctx.user._id)),
        "notif.markRead"
      )
      await connectDB()
      return markRead(ctx.user._id, input.ids)
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await consumeRateLimit(
      mutationLimiter,
      composeKey("notif.markAllRead", String(ctx.user._id)),
      "notif.markAllRead"
    )
    await connectDB()
    return markAllRead(ctx.user._id)
  }),

  remove: protectedProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await connectDB()
      await removeForUser(ctx.user._id, input.id)
      return { success: true }
    }),
})
