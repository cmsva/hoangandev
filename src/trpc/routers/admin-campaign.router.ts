/**
 * Admin Campaign router — quản lý chiến dịch mail/telegram.
 *
 * Endpoints:
 *  - list, detail, create, update, delete
 *  - estimateAudience (preview số người nhận trước khi save)
 *  - queue (lên lịch / gửi ngay)
 *  - cancel
 *  - testSend (gửi thử cho admin)
 */
import { z } from "zod"
import { zObjectId } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import {
  readLimiter,
  mutationLimiter,
  strictLimiter,
  consumeRateLimit,
  composeKey,
} from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import {
  CAMPAIGN_TYPES,
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_STATUSES,
} from "@/models/campaign.model"
import {
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  estimateAudience,
  getCampaignDetail,
  listCampaigns,
  queueCampaign,
  updateCampaign,
} from "@/services/campaign.service"
import { sendRawMail } from "@/lib/send-mail"
import { sendTelegramUserRaw } from "@/lib/send-telegram"
import { TRPCError } from "@trpc/server"
import { User } from "@/models/user.model"

const buttonSchema = z
  .object({
    text: z.string().trim().min(1).max(64),
    url: z.string().trim().url().max(2000),
  })
  .strict()

const baseInput = z.object({
  type: z.enum(CAMPAIGN_TYPES),
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(300).default(""),
  content: z.string().min(1).max(50_000),
  audience: z.enum(CAMPAIGN_AUDIENCES),
  telegramButtons: z.array(buttonSchema).max(6).default([]),
})

export const adminCampaignRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z
        .object({
          type: z.enum(CAMPAIGN_TYPES).optional(),
          status: z.enum([...CAMPAIGN_STATUSES, "all"] as const).default("all"),
          search: z.string().trim().max(200).optional(),
          page: z.number().int().min(1).max(10000).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(
        readLimiter,
        composeKey("admin.campaign.list", String(ctx.user._id)),
        "admin.campaign.list"
      )
      await connectDB()
      return listCampaigns(input)
    }),

  detail: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(
        readLimiter,
        composeKey("admin.campaign.detail", String(ctx.user._id)),
        "admin.campaign.detail"
      )
      await connectDB()
      return getCampaignDetail(input.id)
    }),

  estimateAudience: adminProcedure
    .input(
      z
        .object({
          type: z.enum(CAMPAIGN_TYPES),
          audience: z.enum(CAMPAIGN_AUDIENCES),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(
        readLimiter,
        composeKey("admin.campaign.audience", String(ctx.user._id)),
        "admin.campaign.audience"
      )
      await connectDB()
      return estimateAudience(input)
    }),

  create: adminProcedure
    .input(baseInput.strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("admin.campaign.create", String(ctx.user._id)),
        "admin.campaign.create"
      )
      await connectDB()
      const camp = await createCampaign({
        ...input,
        createdBy: ctx.user._id,
      })
      insertLog({
        userId: ctx.user._id,
        action: `Tạo chiến dịch ${input.type}: ${input.name}`,
        ip: ctx.ip,
      }).catch(() => {})
      return { id: String(camp._id) }
    }),

  update: adminProcedure
    .input(
      z
        .object({
          id: zObjectId,
          name: z.string().trim().min(1).max(200).optional(),
          subject: z.string().trim().max(300).optional(),
          content: z.string().min(1).max(50_000).optional(),
          audience: z.enum(CAMPAIGN_AUDIENCES).optional(),
          telegramButtons: z.array(buttonSchema).max(6).optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("admin.campaign.update", String(ctx.user._id)),
        "admin.campaign.update"
      )
      await connectDB()
      await updateCampaign({
        campaignId: input.id,
        name: input.name,
        subject: input.subject,
        content: input.content,
        audience: input.audience,
        telegramButtons: input.telegramButtons,
      })
      return { success: true, message: "Đã cập nhật" }
    }),

  delete: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("admin.campaign.delete", String(ctx.user._id)),
        "admin.campaign.delete"
      )
      await connectDB()
      await deleteCampaign(input.id)
      insertLog({
        userId: ctx.user._id,
        action: `Xoá chiến dịch ${input.id}`,
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true, message: "Đã xoá" }
    }),

  queue: adminProcedure
    .input(
      z
        .object({
          id: zObjectId,
          /** ISO string. Nếu không có → gửi ngay. */
          scheduledAt: z.string().datetime().nullable().optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("admin.campaign.queue", String(ctx.user._id)),
        "admin.campaign.queue"
      )
      await connectDB()
      const result = await queueCampaign(
        input.id,
        input.scheduledAt ? new Date(input.scheduledAt) : null
      )
      insertLog({
        userId: ctx.user._id,
        action: `Lên lịch chiến dịch ${input.id}: ${result.targetCount} người`,
        ip: ctx.ip,
      }).catch(() => {})
      return {
        ...result,
        message: input.scheduledAt
          ? "Đã lên lịch gửi"
          : "Đã thêm vào hàng đợi, cron sẽ xử lý sớm nhất",
      }
    }),

  cancel: adminProcedure
    .input(z.object({ id: zObjectId }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        mutationLimiter,
        composeKey("admin.campaign.cancel", String(ctx.user._id)),
        "admin.campaign.cancel"
      )
      await connectDB()
      await cancelCampaign(input.id)
      insertLog({
        userId: ctx.user._id,
        action: `Huỷ chiến dịch ${input.id}`,
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true, message: "Đã huỷ chiến dịch" }
    }),

  /** Gửi thử cho chính admin (mail) hoặc chat đã liên kết của admin (tele). */
  testSend: adminProcedure
    .input(
      z
        .object({
          type: z.enum(CAMPAIGN_TYPES),
          subject: z.string().trim().max(300).default(""),
          content: z.string().min(1).max(50_000),
          telegramButtons: z.array(buttonSchema).max(6).default([]),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(
        strictLimiter,
        composeKey("admin.campaign.test", String(ctx.user._id)),
        "admin.campaign.test"
      )
      await connectDB()
      const me = (await User.findById(ctx.user._id)
        .select("email telegramId emailVerified")
        .lean()) as any
      if (!me) throw new TRPCError({ code: "UNAUTHORIZED", message: "User không tồn tại" })

      if (input.type === "mail") {
        if (!me.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Tài khoản chưa có email" })
        if (!input.subject.trim())
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tiêu đề email không được để trống" })
        const r = await sendRawMail(me.email, `[Test] ${input.subject}`, input.content)
        if (!r.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: r.error || "Gửi thất bại" })
        return { success: true, message: `Đã gửi thử về ${me.email}` }
      }

      // Telegram
      if (!me.telegramId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tài khoản admin chưa liên kết Telegram. Liên kết tại trang Profile.",
        })
      }
      const opts = await import("@/models/setting.model").then((m) =>
        m.getSiteOptions(["telegram_token"])
      )
      const token = opts.telegram_token
      if (!token) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bot token chưa cấu hình" })
      }
      const payload: Record<string, unknown> = {
        chat_id: me.telegramId,
        text: input.content,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }
      if (input.telegramButtons.length > 0) {
        payload.reply_markup = {
          inline_keyboard: input.telegramButtons.map((b) => [{ text: b.text, url: b.url }]),
        }
      }
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: txt.slice(0, 200) })
      }
      return { success: true, message: "Đã gửi thử về Telegram của bạn" }
    }),
})
