import { z } from "zod"
import { revalidatePath } from "next/cache"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { readLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import {
  getAdminStats,
  getActivityLogs,
  getBalanceLogs,
  getServerInfo,
} from "@/services/admin.service"
import {
  getGeneralSettings,
  saveGeneralSettings,
  invalidateSiteTitleCache,
} from "@/services/settings.service"
import {
  getSecuritySettings,
  saveSecuritySettings,
  getCronSecretMasked,
  saveCronSecret,
  clearCronSecret,
  generateCronSecret,
} from "@/services/security-settings.service"
import { getCronStatuses } from "@/services/cron-monitor.service"
import {
  getStorageSettings,
  saveStorageSettings,
  testStorageConnection,
} from "@/services/storage.service"

const logListInput = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    userId: z.string().optional(),
    keyword: z.string().max(100).optional(),
  })
  .strict()

const statsInput = z
  .object({
    range: z.enum(["today", "week", "month", "year", "all"]).default("today"),
  })
  .strict()

const saveSettingsInput = z
  .object({
    siteTitle: z.string().max(100),
    siteDescription: z.string().max(500),
    siteKeywords: z.string().max(500),
    siteAuthor: z.string().max(100),
    adminEmail: z.string().max(150),
    adminHotline: z.string().max(50),
    adminFanpage: z.string().max(300),
    adminZalo: z.string().max(100),
    adminTelegram: z.string().max(100),
    adminName: z.string().max(100),
    logoLight: z.string().max(500),
    logoDark: z.string().max(500),
    favicon: z.string().max(500),
    ogImage: z.string().max(500),
    ogDescription: z.string().max(500),
    themeColor: z.string().max(20),
    fontFamily: z.string().max(200),
    fontUrl: z.string().max(500),
  })
  .strict()

const saveSecurityInput = z
  .object({
    rateLimitLogin: z.number().int().min(1).max(1000),
    rateLimitRegister: z.number().int().min(1).max(1000),
    rateLimitForgot: z.number().int().min(1).max(1000),
    rateLimitPurchase: z.number().int().min(0).max(120_000),
    rateLimitDeposit: z.number().int().min(0).max(300_000),
    loginBanDuration: z.number().int().min(1000).max(86_400_000),
    registerEnabled: z.boolean(),
    maintenanceMode: z.boolean(),
    maxPendingInvoices: z.number().int().min(1).max(100),
    apiKeyMaxAttempts: z.number().int().min(1).max(1000),
    securityCsp: z.string().max(2000),
    securityHsts: z.boolean(),
    securityXFrame: z.string().max(50),
    securityReferrer: z.string().max(50),
    rewardEmailMin: z.number().int().min(0).max(10_000_000),
    rewardEmailMax: z.number().int().min(0).max(10_000_000),
    rewardTelegramMin: z.number().int().min(0).max(10_000_000),
    rewardTelegramMax: z.number().int().min(0).max(10_000_000),
    sessionTtl: z.number().int().min(60).max(31_536_000),
  })
  .strict()

const cronSecretInput = z.object({ value: z.string().max(256) }).strict()

const saveStorageInput = z
  .object({
    provider: z.enum(["local", "s3", "r2"]),
    maxMb: z.number().int().min(1).max(50),
    bucket: z.string().max(200),
    region: z.string().max(100),
    endpoint: z.string().max(300),
    publicBaseUrl: z.string().max(300),
    accessKey: z.string().max(500).nullable(),
    secretKey: z.string().max(500).nullable(),
  })
  .strict()

export const adminRouter = createTRPCRouter({
  /** GET admin dashboard stats — chỉ admin truy cập được. */
  getStats: adminProcedure.input(statsInput).query(async ({ ctx, input }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.stats", String(ctx.user._id)), "admin.stats")
    await connectDB()
    return await getAdminStats(input.range)
  }),

  /** List activity logs với pagination + filter keyword. */
  getActivityLogs: adminProcedure
    .input(logListInput)
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("admin.actLogs", String(ctx.user._id)), "admin.actLogs")
      await connectDB()
      return await getActivityLogs(input)
    }),

  /** List balance logs với pagination + filter keyword. */
  getBalanceLogs: adminProcedure
    .input(logListInput)
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("admin.balLogs", String(ctx.user._id)), "admin.balLogs")
      await connectDB()
      return await getBalanceLogs(input)
    }),

  /** OS + Process metrics — display only. */
  getServerInfo: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.srvInfo", String(ctx.user._id)), "admin.srvInfo")
    return getServerInfo()
  }),

  /** Lấy general settings (SEO + Images + Theme). */
  getGeneralSettings: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.getSettings", String(ctx.user._id)), "admin.getSettings")
    return await getGeneralSettings()
  }),

  /** Lưu general settings. */
  saveGeneralSettings: adminProcedure
    .input(saveSettingsInput)
    .mutation(async ({ input }) => {
      await connectDB()
      await saveGeneralSettings(input)
      // saveGeneralSettings đã xóa in-memory cache; revalidate route cache
      // để layout (title/theme/font/JSON-LD) hiển thị dữ liệu mới ngay.
      invalidateSiteTitleCache()
      revalidatePath("/", "layout")
      return { success: true }
    }),

  // ─── Security ────────────────────────────────────────────────────────────

  /** Lấy security settings (rate limits, headers, rewards, session TTL). */
  getSecuritySettings: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.getSec", String(ctx.user._id)), "admin.getSec")
    return await getSecuritySettings()
  }),

  /** Lưu security settings — clamp + invalidate cache để áp ngay. */
  saveSecuritySettings: adminProcedure
    .input(saveSecurityInput)
    .mutation(async ({ input }) => {
      // Validate cross-field
      if (input.rewardEmailMax < input.rewardEmailMin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email max phải ≥ min" })
      }
      if (input.rewardTelegramMax < input.rewardTelegramMin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Telegram max phải ≥ min" })
      }
      await saveSecuritySettings(input)
      revalidatePath("/", "layout")
      return { success: true }
    }),

  /** Trả masked cron secret + nguồn (DB / env / chưa cấu hình). */
  getCronSecret: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.cronSec", String(ctx.user._id)), "admin.cronSec")
    return await getCronSecretMasked()
  }),

  /** Lưu cron secret vào DB (DB ưu tiên hơn env). */
  saveCronSecret: adminProcedure
    .input(cronSecretInput)
    .mutation(async ({ input }) => {
      try {
        await saveCronSecret(input.value)
        return { success: true }
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err?.message || "Lưu thất bại" })
      }
    }),

  /** Xoá cron secret khỏi DB → fallback về env CRON_SECRET. */
  clearCronSecret: adminProcedure.mutation(async () => {
    await clearCronSecret()
    return { success: true }
  }),

  /** Sinh cron secret ngẫu nhiên — chỉ trả về cho admin. */
  generateCronSecret: adminProcedure.mutation(async () => {
    return { value: generateCronSecret() }
  }),

  /** List cron job + last run (để giám sát trên tab Cronjob). */
  getCronStatuses: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.cronStatus", String(ctx.user._id)), "admin.cronStatus")
    return await getCronStatuses()
  }),

  // ─── Storage ────────────────────────────────────────────────

  /** Lấy cấu hình lưu trữ (credential đã mask). */
  getStorageSettings: adminProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("admin.getStorage", String(ctx.user._id)), "admin.getStorage")
    return await getStorageSettings()
  }),

  /** Lưu cấu hình lưu trữ — encrypt credential + invalidate cache để áp ngay. */
  saveStorageSettings: adminProcedure
    .input(saveStorageInput)
    .mutation(async ({ input }) => {
      await saveStorageSettings(input)
      return { success: true }
    }),

  /** Test kết nối lưu trữ đám mây (ghi thử 1 file nhỏ). */
  testStorageConnection: adminProcedure.mutation(async () => {
    return await testStorageConnection()
  }),
})

