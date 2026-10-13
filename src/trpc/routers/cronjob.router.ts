/**
 * Cronjob router — thin tRPC layer.
 *
 * Trách nhiệm: auth + rate-limit + validate input + delegate.
 * Toàn bộ logic ở @/services/cronjob.service + shared (balance).
 */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, baseProcedure, protectedProcedure } from "../init"
import { CRONJOB_STATUSES, HTTP_METHODS, ServerCronjob } from "@/models/cronjob.model"
import { connectDB } from "@/lib/db"
import {
  readLimiter,
  mutationLimiter,
  strictLimiter,
  consumeRateLimit,
  composeKey,
} from "@/lib/rate-limit"
import { objectIdSchema, paginationSchema, searchSchema } from "@/lib/sanitize"
import { insertLog } from "@/services/log.service"
import {
  deleteCronjobByOwner,
  editCronjobConfig,
  findUserCronjob,
  listActiveServers,
  listMyCronjobs,
  parseHeadersJson,
  purchaseCronjob,
  purchaseCronjobExtension,
  toggleCronjobStatus,
  validateCronUrl,
  validateInterval,
} from "@/services/cronjob.service"

const sortFieldSchema = z
  .enum(["url", "payment", "createdAt", "expiresAt", "lastRun"])
  .default("createdAt")
const sortDirSchema = z.enum(["asc", "desc"]).default("desc")
const statusFilterSchema = z.enum(CRONJOB_STATUSES).optional()

export const cronjobRouter = createTRPCRouter({
  // ─── List server catalog ─────────────────────────────────────────────────
  listServers: baseProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("cron.servers", ctx.ip), "listServers")
    await connectDB()
    return await listActiveServers()
  }),

  // ─── User's cronjobs ─────────────────────────────────────────────────────
  myCronjobs: protectedProcedure
    .input(
      paginationSchema(50)
        .extend({
          search: searchSchema,
          sortField: sortFieldSchema,
          sortDir: sortDirSchema,
          status: statusFilterSchema,
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("cron.myList", String(ctx.user._id)), "myList")
      await connectDB()

      const { page, limit } = input
      const { items, total } = await listMyCronjobs({
        userId: ctx.user._id as any,
        ...input,
      })

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      }
    }),

  // ─── Create cronjob ──────────────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z
        .object({
          serverId: objectIdSchema,
          url: z.string().trim().min(1).max(2048),
          method: z.enum(HTTP_METHODS).default("GET"),
          intervalSeconds: z
            .number({ message: "Số giây không hợp lệ" })
            .int("Số giây phải là số nguyên")
            .min(1, "Số giây phải lớn hơn 0")
            .max(31_536_000, "Vòng lặp tối đa 1 năm"),
          month: z.number().int().min(1).max(24),
          headers: z.string().trim().max(8192).optional().nullable(),
          body: z.string().trim().max(16384).optional().nullable(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("cron.create", String(ctx.user._id)), "createCron")
      await consumeRateLimit(mutationLimiter, composeKey("cron.create:ip", ctx.ip), "createCron.ip")
      await connectDB()

      const result = await purchaseCronjob({ userId: ctx.user._id as any, ...input })

      insertLog({
        userId: ctx.user._id,
        action: `Tạo cronjob: ${result.url.slice(0, 80)} - ${result.payment.toLocaleString()}đ`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      // Notify (mail + tele admin + tele user) — best-effort
      void import("@/services/notify.service").then((m) =>
        m.notifyOrderCronjob({
          userId: ctx.user._id as any,
          url: result.url,
          interval: input.intervalSeconds,
          months: input.month,
          total: result.payment,
        })
      )

      return {
        success: true,
        jobId: result.jobId,
        payment: result.payment,
        message: "Tạo cronjob thành công",
      }
    }),

  // ─── Toggle pause/active ─────────────────────────────────────────────────
  toggleStatus: protectedProcedure
    .input(z.object({ jobId: objectIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("cron.toggle", String(ctx.user._id)), "toggleCron")
      await connectDB()

      const next = await toggleCronjobStatus(ctx.user._id as any, input.jobId)

      insertLog({
        userId: ctx.user._id,
        action: `${next === "active" ? "Bật" : "Tạm dừng"} cronjob ${input.jobId}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return { success: true, status: next }
    }),

  // ─── Delete cronjob ──────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ jobId: objectIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("cron.delete", String(ctx.user._id)), "deleteCron")
      await connectDB()

      await deleteCronjobByOwner(ctx.user._id as any, input.jobId)

      insertLog({
        userId: ctx.user._id,
        action: `Xóa cronjob ${input.jobId}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return { success: true }
    }),

  // ─── Edit cronjob config ─────────────────────────────────────────────────
  edit: protectedProcedure
    .input(
      z
        .object({
          jobId: objectIdSchema,
          url: z.string().trim().min(1).max(2048),
          method: z.enum(HTTP_METHODS).default("GET"),
          intervalSeconds: z
            .number({ message: "Số giây không hợp lệ" })
            .int("Số giây phải là số nguyên")
            .min(30, "Vòng lặp tối thiểu 30 giây")
            .max(31_536_000, "Vòng lặp tối đa 1 năm"),
          headers: z.string().trim().max(8192).optional().nullable(),
          body: z.string().trim().max(16384).optional().nullable(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("cron.edit", String(ctx.user._id)), "editCron")
      await connectDB()

      const urlCheck = validateCronUrl(input.url)
      if (!urlCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: urlCheck.reason })

      try {
        parseHeadersJson(input.headers ?? null)
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message })
      }

      const intCheck = validateInterval(input.intervalSeconds)
      if (!intCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: intCheck.reason })

      const job = await findUserCronjob(ctx.user._id as any, input.jobId)
      if (job.status === "expired") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cronjob đã hết hạn" })
      }

      const server = (await ServerCronjob.findById(job.serverId).select("timeloop").lean()) as any
      if (server && input.intervalSeconds < (server.timeloop || 30)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Vòng lặp tối thiểu ${server.timeloop}s`,
        })
      }

      await editCronjobConfig(ctx.user._id as any, input.jobId, {
        url: input.url,
        method: input.method,
        intervalSeconds: input.intervalSeconds,
        headers: input.headers || null,
        body: input.body || null,
      })

      insertLog({
        userId: ctx.user._id,
        action: `Sửa cronjob ${input.jobId}: ${input.url.slice(0, 80)}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return { success: true, message: "Cập nhật cronjob thành công" }
    }),

  // ─── Extend cronjob (gia hạn tháng) ──────────────────────────────────────
  extend: protectedProcedure
    .input(
      z
        .object({
          jobId: objectIdSchema,
          additionalMonths: z.number().int().min(1).max(24),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("cron.extend", String(ctx.user._id)), "extendCron")
      await connectDB()

      const result = await purchaseCronjobExtension({ userId: ctx.user._id as any, ...input })

      insertLog({
        userId: ctx.user._id,
        action: `Gia hạn cronjob ${input.jobId} +${input.additionalMonths} tháng - ${result.payment.toLocaleString()}đ`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      // Notify (mail + tele admin + tele user) — best-effort
      void import("@/services/notify.service").then((m) =>
        m.notifyRenewCronjob({
          userId: ctx.user._id as any,
          url: (result as any).url || String(input.jobId),
          months: input.additionalMonths,
          total: result.payment,
        })
      )

      return {
        success: true,
        payment: result.payment,
        newExpiresAt: result.newExpiresAt,
        message: `Gia hạn thành công (+${input.additionalMonths} tháng)`,
      }
    }),
})
