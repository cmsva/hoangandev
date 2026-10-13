/**
 * Admin Notification router — gửi broadcast cho users + quản lý.
 */
import { z } from "zod"
import { zObjectId } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import {
  mutationLimiter,
  readLimiter,
  consumeRateLimit,
  composeKey,
} from "@/lib/rate-limit"
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { insertLog } from "@/services/log.service"
import {
  ALL_NOTIFICATION_TYPES,
  adminDeleteBroadcast,
  adminListBroadcasts,
  createForAll,
  createForUsers,
} from "@/services/notification.service"
import {
  BANNER_VARIANTS,
  getSiteNotifications,
  saveSiteNotifications,
} from "@/services/site-notification.service"
import { User } from "@/models/user.model"

const notificationTypeEnum = z.enum(ALL_NOTIFICATION_TYPES)

export const adminNotificationRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).max(10000).default(1),
          limit: z.number().int().min(1).max(100).default(20),
          search: z.string().trim().max(200).optional(),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(
        readLimiter,
        composeKey("admin.notif.list", String(ctx.user._id)),
        "admin.notif.list"
      )
      await connectDB()
      return adminListBroadcasts(input)
    }),

  /** Gửi broadcast — toàn bộ user, hoặc subset cụ thể (theo username/email/userIds). */
  send: adminProcedure
    .input(
      z
        .object({
          type: notificationTypeEnum.default("general"),
          title: z.string().trim().min(1).max(300),
          content: z.string().max(50_000).default(""),
          link: z
            .string()
            .trim()
            .max(500)
            .nullable()
            .optional()
            .transform((v) => (v && v.length ? v : null)),
          target: z.enum(["all", "users"]),
          /** Khi target='users': accept các định danh tự do (username | email | objectId). */
          userIdentifiers: z.array(z.string().trim().min(1)).max(2000).default([]),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("admin.notif.send", String(ctx.user._id)),
        "admin.notif.send"
      )
      await connectDB()

      let inserted = 0
      if (input.target === "all") {
        const r = await createForAll({
          type: input.type,
          source: "admin",
          title: input.title,
          content: input.content,
          link: input.link ?? null,
        })
        inserted = r.inserted
      } else {
        if (input.userIdentifiers.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Vui lòng chọn ít nhất 1 người nhận",
          })
        }
        // Resolve identifiers → userIds. Hỗ trợ ObjectId | username | email.
        const ids: Types.ObjectId[] = []
        const others: string[] = []
        for (const v of input.userIdentifiers) {
          if (Types.ObjectId.isValid(v) && /^[a-f0-9]{24}$/i.test(v)) {
            ids.push(new Types.ObjectId(v))
          } else {
            others.push(v.toLowerCase())
          }
        }
        let resolvedIds = [...ids]
        if (others.length > 0) {
          const found = (await User.find({
            $or: [{ username: { $in: others } }, { email: { $in: others } }],
          })
            .select("_id")
            .lean()) as Array<{ _id: Types.ObjectId }>
          resolvedIds = resolvedIds.concat(found.map((u) => u._id))
        }
        // Dedup
        const uniq = Array.from(new Set(resolvedIds.map((id) => String(id))))
          .map((s) => new Types.ObjectId(s))
        if (uniq.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Không tìm thấy người dùng phù hợp",
          })
        }
        const r = await createForUsers(uniq, {
          type: input.type,
          source: "admin",
          title: input.title,
          content: input.content,
          link: input.link ?? null,
        })
        inserted = r.inserted
      }

      insertLog({
        userId: ctx.user._id,
        action: `Broadcast thông báo "${input.title}" cho ${inserted} người`,
        ip: ctx.ip,
      }).catch(() => {})

      return {
        success: true,
        inserted,
        message: `Đã gửi cho ${inserted.toLocaleString("vi-VN")} người`,
      }
    }),

  /** Đếm sơ bộ số user (cho preview trên form). */
  countAudience: adminProcedure
    .input(
      z
        .object({
          target: z.enum(["all", "users"]),
          userIdentifiers: z.array(z.string().trim().min(1)).max(2000).default([]),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(
        readLimiter,
        composeKey("admin.notif.count", String(ctx.user._id)),
        "admin.notif.count"
      )
      await connectDB()
      if (input.target === "all") {
        const count = await User.countDocuments({ banned: { $ne: 1 } })
        return { count }
      }
      const ids: Types.ObjectId[] = []
      const others: string[] = []
      for (const v of input.userIdentifiers) {
        if (Types.ObjectId.isValid(v) && /^[a-f0-9]{24}$/i.test(v)) {
          ids.push(new Types.ObjectId(v))
        } else {
          others.push(v.toLowerCase())
        }
      }
      let resolvedIds = [...ids]
      if (others.length > 0) {
        const found = (await User.find({
          $or: [{ username: { $in: others } }, { email: { $in: others } }],
        })
          .select("_id")
          .lean()) as Array<{ _id: Types.ObjectId }>
        resolvedIds = resolvedIds.concat(found.map((u) => u._id))
      }
      const uniq = new Set(resolvedIds.map((id) => String(id)))
      return { count: uniq.size }
    }),

  delete: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await connectDB()
      const r = await adminDeleteBroadcast(input.id)
      insertLog({
        userId: ctx.user._id,
        action: `Xoá đợt thông báo, ${r.deleted} rows`,
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true, deleted: r.deleted }
    }),

  // ─── Site notifications: homepage banner + floating popup ──────────────────
  getSiteNotifications: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(
      readLimiter,
      composeKey("admin.siteNotif.get", String(ctx.user._id)),
      "admin.siteNotif.get"
    )
    await connectDB()
    return getSiteNotifications()
  }),

  saveSiteNotifications: adminProcedure
    .input(
      z
        .object({
          bannersEnabled: z.boolean(),
          banners: z
            .array(
              z.object({
                id: z.string().trim().min(1).max(64),
                enabled: z.boolean(),
                variant: z.enum(BANNER_VARIANTS),
                contentHtml: z.string().max(20_000).default(""),
              })
            )
            .max(5)
            .default([]),
          popup: z.object({
            enabled: z.boolean(),
            contentHtml: z.string().max(20_000).default(""),
          }),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("admin.siteNotif.save", String(ctx.user._id)),
        "admin.siteNotif.save"
      )
      await connectDB()
      await saveSiteNotifications(input)
      insertLog({
        userId: ctx.user._id,
        action: "Admin cập nhật banner & popup dashboard",
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true }
    }),
})
