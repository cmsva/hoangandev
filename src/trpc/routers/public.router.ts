/**
 * Public Router — Endpoints public (không yêu cầu auth) cho config động.
 */
import { z } from "zod"
import { createTRPCRouter, baseProcedure } from "../init"
import { getPublicCaptchaConfig } from "@/lib/captcha"
import { getSecurityConfig } from "@/lib/security-config"
import { readLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { trackAffiliateClick } from "@/services/affiliate.service"
import { getCachedGeneralSettings } from "@/services/settings.service"
import { getCachedSiteNotifications } from "@/services/site-notification.service"

export const publicRouter = createTRPCRouter({
  /** Captcha config (chỉ public fields) */
  captchaConfig: baseProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("pub.captcha", ctx.ip), "pub.captcha")
    return await getPublicCaptchaConfig()
  }),

  /** Site info — branding + contact (non-sensitive) cho sidebar/header/contact page */
  siteInfo: baseProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("pub.siteInfo", ctx.ip), "pub.siteInfo")
    const s = await getCachedGeneralSettings()
    return {
      siteTitle: s.siteTitle,
      siteDescription: s.siteDescription,
      logoLight: s.logoLight,
      logoDark: s.logoDark,
      favicon: s.favicon,
      email: s.adminEmail,
      hotline: s.adminHotline,
      fanpage: s.adminFanpage,
      zalo: s.adminZalo,
      telegram: s.adminTelegram,
      adminName: s.adminName,
    }
  }),

  /** Announcement banner */
  announcement: baseProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("pub.announce", ctx.ip), "pub.announce")
    const cfg = await getSecurityConfig()
    return {
      enabled: cfg.announcementEnabled,
      title: cfg.announcementTitle,
      content: cfg.announcementContent,
    }
  }),

  /** Site notifications — homepage banner + floating popup (public, non-sensitive) */
  siteNotifications: baseProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("pub.siteNotif", ctx.ip), "pub.siteNotif")
    return await getCachedSiteNotifications()
  }),

  /** App config (register enabled, etc.) */
  appConfig: baseProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("pub.appCfg", ctx.ip), "pub.appCfg")
    const cfg = await getSecurityConfig()
    return {
      registerEnabled: cfg.registerEnabled,
      maintenanceMode: cfg.maintenanceMode,
    }
  }),

  /**
   * Track affiliate click — best-effort, fire-and-forget.
   *
   * Service đã có throttle 6h/IP+refId nên user spam refresh không tăng được.
   * Endpoint vẫn rate-limit để tránh DDoS.
   */
  trackAffClick: baseProcedure
    .input(z.object({ refId: z.string().min(24).max(24) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("aff.track", ctx.ip), "aff.track")
      // Fire-and-forget — service tự handle error
      trackAffiliateClick({ refId: input.refId, ip: ctx.ip }).catch(() => {})
      return { ok: true }
    }),
})
