/**
 * Domain router — thin tRPC layer.
 *
 * Trách nhiệm: auth + rate-limit + validate input + delegate to services.
 * Toàn bộ logic ở @/services/domain.service + shared (balance, coupon).
 */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, protectedProcedure } from "../init"
import { ORDER_DOMAIN_STATUSES } from "@/models/domain.model"
import { connectDB } from "@/lib/db"
import {
  readLimiter,
  mutationLimiter,
  strictLimiter,
  consumeRateLimit,
  composeKey,
} from "@/lib/rate-limit"
import { objectIdSchema, paginationSchema, searchSchema } from "@/lib/sanitize"
import { logger } from "@/lib/logger"
import { lookupWhois, lookupWhoisBatch } from "@/lib/whois"
import { getActiveTlds } from "@/lib/tld-cache"
import { insertLog } from "@/services/log.service"
import {
  ParsedDomain,
  checkDomainOwnership,
  initiateSpaceshipRegistration,
  completeSpaceshipRenewal,
  createDomainOrder,
  deleteDomainOrderSafe,
  findActiveTldById,
  findCompletedOrderForRenew,
  getDomainStats,
  isDomainOccupied,
  listMyDomainOrders,
  listRecentDomainOrders,
  listTlds,
  lockOrderForRenew,
  parseDomain,
  resolveDomainProvider,
  unlockRenew,
  updateOrderNameservers,
  validateNameserver,
} from "@/services/domain.service"
import {
  deductBalanceAtomic,
  ensureUserHasBalance,
  logBalanceChange,
} from "@/services/balance.service"
import {
  commitCouponUsage,
  validateCouponForUser,
} from "@/services/coupon.service"
import { OrderDomain, ACTIVE_DOMAIN_STATUSES } from "@/models/domain.model"

// ─── Schemas ────────────────────────────────────────────────────────────────
const sortFieldSchema = z
  .enum(["domainName", "totalAmount", "createdAt", "expiredAt"])
  .default("createdAt")
const sortDirSchema = z.enum(["asc", "desc"]).default("desc")
const statusFilterSchema = z.enum(ORDER_DOMAIN_STATUSES).optional()

const nameserverSchema = z
  .string()
  .trim()
  .max(253)
  .refine(validateNameserver, "Nameserver không hợp lệ")

const sldSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4, "Tên miền phải có ít nhất 4 ký tự (không tính đuôi)")
  .max(63)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    "Chỉ chữ, số, dấu gạch ngang"
  )

// Thông tin chủ thể đăng ký (registrant). address2 tuỳ chọn, còn lại bắt buộc.
const registrantSchema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập tên công ty hoặc cá nhân").max(191),
  address1: z.string().trim().min(2, "Vui lòng nhập địa chỉ 1").max(255),
  address2: z.string().trim().max(255).optional().default(""),
  province: z.string().trim().min(1, "Vui lòng nhập tỉnh thành").max(128),
  phone: z
    .string()
    .trim()
    .min(8, "Số điện thoại không hợp lệ")
    .max(32)
    .regex(/^[0-9+\s().-]+$/, "Số điện thoại không hợp lệ"),
  zipCode: z
    .string()
    .trim()
    .min(4, "Mã zip không hợp lệ")
    .max(16)
    .regex(/^[0-9]+$/, "Mã zip chỉ gồm chữ số"),
})

export const domainRouter = createTRPCRouter({
  // ─── List TLDs (catalog) ─────────────────────────────────────────────────
  listTlds: protectedProcedure
    .input(
      paginationSchema(100)
        .extend({
          search: searchSchema,
          activeOnly: z.boolean().default(true),
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("domain.tlds", String(ctx.user._id)), "tlds")
      await connectDB()

      const { items, total } = await listTlds(input)
      return {
        items,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / input.limit)),
        },
      }
    }),

  // ─── Get TLD theo tên ────────────────────────────────────────────────────
  getTldByName: protectedProcedure
    .input(z.object({ tld: z.string().trim().toLowerCase().min(1).max(64) }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("domain.tld", String(ctx.user._id)), "tld")
      const list = await getActiveTlds()
      const tld = list.find((t) => t.tld === input.tld)
      if (!tld) return null
      return {
        id: tld.id,
        tld: tld.tld,
        priceSold: tld.priceSold,
        renewSold: tld.renewSold,
      }
    }),

  // ─── Check availability ──────────────────────────────────────────────────
  checkAvailability: protectedProcedure
    .input(
      z.object({ domainName: z.string().trim().toLowerCase().min(3).max(253) }).strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("domain.check", String(ctx.user._id)), "check")
      await connectDB()

      const tlds = await getActiveTlds()
      const tldNames = tlds.map((t) => t.tld)

      let parsed: ParsedDomain
      try {
        parsed = parseDomain(input.domainName, tldNames)
      } catch (err: any) {
        return {
          available: false,
          domainName: input.domainName,
          reason: err.message,
          tld: null,
          priceSold: null,
        }
      }

      const tldDoc = tlds.find((t) => t.tld === parsed.tld)
      if (!tldDoc) {
        return {
          available: false,
          domainName: parsed.full,
          reason: "TLD không khả dụng",
          tld: parsed.tld,
          priceSold: null,
        }
      }

      const occupied = await isDomainOccupied(parsed.full)

      return {
        available: !occupied,
        domainName: parsed.full,
        sld: parsed.sld,
        tld: parsed.tld,
        priceSold: tldDoc.priceSold,
        renewSold: tldDoc.renewSold,
        reason: occupied ? "Domain đã được đăng ký" : null,
      }
    }),

  // ─── Whois single ────────────────────────────────────────────────────────
  whois: protectedProcedure
    .input(z.object({ domainName: z.string().trim().toLowerCase().min(3).max(253) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("domain.whois", String(ctx.user._id)), "whois")
      await consumeRateLimit(mutationLimiter, composeKey("domain.whois:ip", ctx.ip), "whois.ip")
      await connectDB()

      const tlds = await getActiveTlds()
      const tldNames = tlds.map((t) => t.tld)

      let parsed: ParsedDomain
      try {
        parsed = parseDomain(input.domainName, tldNames)
      } catch (err: any) {
        return {
          available: false,
          domainName: input.domainName,
          reason: err.message,
          source: "local" as const,
          whois: null,
        }
      }

      const tldDoc = tlds.find((t) => t.tld === parsed.tld)
      const occupied = await isDomainOccupied(parsed.full)

      if (occupied) {
        return {
          available: false,
          domainName: parsed.full,
          sld: parsed.sld,
          tld: parsed.tld,
          priceSold: tldDoc?.priceSold ?? null,
          renewSold: tldDoc?.renewSold ?? null,
          reason: "Domain đã được đăng ký trong hệ thống",
          source: "internal" as const,
          whois: null,
        }
      }

      const whois = await lookupWhois(parsed.full).catch((err) => {
        logger.warn("whois lookup failed", { module: "domain.whois", error: err?.message })
        return null
      })

      const isAvailableExt = whois?.status === "available"
      const isRegisteredExt = whois?.status === "registered"
      const isError = !whois || whois.status === "error"

      return {
        available: isAvailableExt,
        registered: isRegisteredExt,
        domainName: parsed.full,
        sld: parsed.sld,
        tld: parsed.tld,
        priceSold: tldDoc?.priceSold ?? null,
        renewSold: tldDoc?.renewSold ?? null,
        reason: isError
          ? "Lỗi: không tra cứu được whois"
          : isAvailableExt
          ? null
          : "Domain đã có người đăng ký bên ngoài",
        source: (whois?.source ?? "fallback") as
          | "inet.vn"
          | "rdap"
          | "fallback"
          | "internal"
          | "local",
        whois: whois
          ? {
              status: whois.status,
              source: whois.source,
              registrar: whois.registrar ?? null,
              registrantName: whois.registrantName ?? null,
              registrantOrg: null,
              createdAt: whois.createdAt ?? null,
              expiredAt: whois.expiredAt ?? null,
              nameservers: whois.nameservers ?? [],
            }
          : null,
      }
    }),

  // ─── Whois batch ─────────────────────────────────────────────────────────
  whoisBatch: protectedProcedure
    .input(
      z
        .object({
          domains: z.array(z.string().trim().toLowerCase().min(3).max(253)).min(1).max(20),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("domain.whoisBatch", String(ctx.user._id)), "whoisBatch")
      await consumeRateLimit(mutationLimiter, composeKey("domain.whoisBatch:ip", ctx.ip), "whoisBatch.ip")
      await connectDB()

      const [occupiedDocs, externalMap] = await Promise.all([
        OrderDomain.find(
          {
            domainName: { $in: input.domains },
            status: { $in: ACTIVE_DOMAIN_STATUSES },
          },
          { domainName: 1 }
        ).lean(),
        lookupWhoisBatch(input.domains, 8),
      ])

      const occupiedSet = new Set((occupiedDocs as any[]).map((d) => d.domainName))

      const results: Record<string, {
        available: boolean
        registered: boolean
        error: boolean
        source: string
        reason: string | null
        registrar: string | null
        registrantName: string | null
        createdAt: string | null
        expiredAt: string | null
        nameservers: string[]
      }> = {}

      for (const domain of input.domains) {
        const ext = externalMap[domain]
        const isInternalOccupied = occupiedSet.has(domain)

        if (isInternalOccupied) {
          results[domain] = {
            available: false,
            registered: true,
            error: false,
            source: "internal",
            reason: "Đã có người mua trong hệ thống",
            registrar: null,
            registrantName: null,
            createdAt: null,
            expiredAt: null,
            nameservers: [],
          }
          continue
        }

        if (!ext || ext.status === "error") {
          results[domain] = {
            available: false,
            registered: false,
            error: true,
            source: ext?.source ?? "fallback",
            reason: "Lỗi",
            registrar: null,
            registrantName: null,
            createdAt: null,
            expiredAt: null,
            nameservers: [],
          }
          continue
        }

        if (ext.status === "available") {
          results[domain] = {
            available: true,
            registered: false,
            error: false,
            source: ext.source,
            reason: null,
            registrar: null,
            registrantName: null,
            createdAt: null,
            expiredAt: null,
            nameservers: [],
          }
          continue
        }

        results[domain] = {
          available: false,
          registered: true,
          error: false,
          source: ext.source,
          reason: "Đã được đăng ký",
          registrar: ext.registrar ?? null,
          registrantName: ext.registrantName ?? null,
          createdAt: ext.createdAt ?? null,
          expiredAt: ext.expiredAt ?? null,
          nameservers: ext.nameservers ?? [],
        }
      }

      return { results }
    }),

  // ─── My orders ───────────────────────────────────────────────────────────
  myOrders: protectedProcedure
    .input(
      paginationSchema(50)
        .extend({
          search: searchSchema,
          status: statusFilterSchema,
          sortField: sortFieldSchema,
          sortDir: sortDirSchema,
        })
        .strict()
    )
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("domain.myOrders", String(ctx.user._id)), "myOrders")
      await connectDB()

      const { items, total } = await listMyDomainOrders({
        userId: ctx.user._id as any,
        ...input,
      })

      return {
        items,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / input.limit)),
        },
      }
    }),

  // ─── Recent orders (dashboard) ──────────────────────────────────────────
  recentOrders: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("domain.recent", String(ctx.user._id)), "recent")
    await connectDB()
    return await listRecentDomainOrders(ctx.user._id as any)
  }),

  // ─── Stats ───────────────────────────────────────────────────────────────
  stats: protectedProcedure.query(async ({ ctx }) => {
    await consumeRateLimit(readLimiter, composeKey("domain.stats", String(ctx.user._id)), "stats")
    await connectDB()
    return await getDomainStats(ctx.user._id as any)
  }),

  // ─── Check ownership ────────────────────────────────────────────────────
  checkOwnership: protectedProcedure
    .input(z.object({ domainName: z.string().trim().toLowerCase().min(3).max(253) }).strict())
    .query(async ({ ctx, input }) => {
      await consumeRateLimit(readLimiter, composeKey("domain.own", String(ctx.user._id)), "own")
      await connectDB()
      return await checkDomainOwnership(ctx.user._id as any, input.domainName)
    }),

  // ─── Đăng ký domain mới ─────────────────────────────────────────────────
  register: protectedProcedure
    .input(
      z
        .object({
          sld: sldSchema,
          tldId: objectIdSchema,
          ns1: nameserverSchema,
          ns2: nameserverSchema,
          registrant: registrantSchema,
          couponCode: z.string().trim().min(1).max(64).optional(),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("domain.register", String(ctx.user._id)), "register")
      await consumeRateLimit(mutationLimiter, composeKey("domain.register:ip", ctx.ip), "register.ip")
      await connectDB()

      // 1. TLD active?
      const tldDoc = await findActiveTldById(input.tldId)
      const domainName = `${input.sld.toLowerCase()}.${tldDoc.tld.toLowerCase()}`
      if (domainName.length > 253) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tên domain quá dài" })
      }

      const totalAmount = Number(tldDoc.priceSold) || 0
      if (totalAmount <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Giá TLD không hợp lệ" })
      }

      // 2. Coupon (optional)
      let finalAmount = totalAmount
      let couponId: string | null = null
      let couponCode: string | null = null
      if (input.couponCode && totalAmount > 0) {
        const c = await validateCouponForUser(
          ctx.user._id as any,
          input.couponCode,
          totalAmount,
          "domain"
        )
        finalAmount = c.finalAmount
        couponId = c.couponId
        couponCode = c.code
      }

      // 3. Balance check
      await ensureUserHasBalance(ctx.user._id as any, finalAmount)

      // 4. Create order (E11000 → CONFLICT)
      const provider = await resolveDomainProvider(tldDoc)
      const newOrder = await createDomainOrder({
        userId: ctx.user._id as any,
        tldId: tldDoc._id,
        tldName: tldDoc.tld,
        domainName,
        ns1: input.ns1,
        ns2: input.ns2,
        totalAmount: finalAmount,
        provider,
        registrant: {
          name: input.registrant.name,
          address1: input.registrant.address1,
          address2: input.registrant.address2 || "",
          province: input.registrant.province,
          phone: input.registrant.phone,
          zipCode: input.registrant.zipCode,
        },
      })

      // 5. CAS deduct balance
      const balance = await deductBalanceAtomic(ctx.user._id as any, finalAmount)
      if (!balance) {
        await deleteDomainOrderSafe(newOrder._id as any)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Số dư đã thay đổi. Vui lòng thử lại.",
        })
      }

      logBalanceChange({
        userId: ctx.user._id as any,
        moneyBefore: balance.moneyBefore,
        moneyAfter: balance.moneyAfter,
        moneyChange: -finalAmount,
        content: `Đăng ký domain: ${domainName}`,
        module: "domain.register",
        orderId: (newOrder._id as any).toString(),
      })
      void import("@/services/rewards.service").then((m) =>
        m.awardRewardForPurchase({
          userId: ctx.user._id as any,
          vndAmount: finalAmount,
          context: `tên miền ${domainName}`,
          refOrderId: newOrder._id as any,
          refOrderType: "domain",
        })
      )

      // 6. Coupon usage
      if (couponId) {
        await commitCouponUsage(couponId, ctx.user._id as any, (newOrder._id as any).toString())
      }

      // 7. Spaceship auto — initiate async (cron sẽ poll)
      if (provider === "spaceship") {
        // Fire-and-forget: initiateSpaceshipRegistration handles errors internally
        // (refund + log nếu API fail ngay, hoặc lưu asyncOpId cho cron poll)
        initiateSpaceshipRegistration({
          orderId: newOrder._id as any,
          userId: ctx.user._id as any,
          domainName,
          ns1: input.ns1,
          ns2: input.ns2,
          paidAmount: finalAmount,
        }).catch((err) => {
          logger.error("initiateSpaceshipRegistration unhandled", err instanceof Error ? err : { error: String(err) }, {
            module: "domain.router.register",
            orderId: (newOrder._id as any).toString(),
          })
        })
      }

      // 8. Audit
      insertLog({
        userId: ctx.user._id,
        action: `Đăng ký domain: ${domainName} - ${finalAmount.toLocaleString()}đ${couponCode ? ` [coupon ${couponCode}]` : ""}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      // 9. Notify (mail + tele admin + tele user) — best-effort
      void import("@/services/notify.service").then((m) =>
        m.notifyOrderDomain({
          userId: ctx.user._id as any,
          domainName,
          total: finalAmount,
        })
      )

      return {
        success: true,
        orderId: (newOrder._id as any).toString(),
        domainName,
        totalAmount: finalAmount,
        provider,
        message: provider === "spaceship"
          ? "Đang xử lý auto, hệ thống sẽ cập nhật sau"
          : "Đăng ký domain thành công",
      }
    }),

  // ─── Update nameserver ──────────────────────────────────────────────────
  updateNameserver: protectedProcedure
    .input(
      z
        .object({
          orderId: objectIdSchema,
          ns1: nameserverSchema,
          ns2: nameserverSchema,
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("domain.ns", String(ctx.user._id)), "updateNs")
      await connectDB()

      const updated = await updateOrderNameservers(
        ctx.user._id as any,
        input.orderId,
        input.ns1,
        input.ns2
      )

      insertLog({
        userId: ctx.user._id,
        action: `Cập nhật nameserver: ${updated.domainName}`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return {
        success: true,
        domainName: updated.domainName,
        ns1: updated.ns1,
        ns2: updated.ns2,
      }
    }),

  // ─── Yêu cầu gia hạn ────────────────────────────────────────────────────
  requestRenew: protectedProcedure
    .input(z.object({ orderId: objectIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(strictLimiter, composeKey("domain.renew", String(ctx.user._id)), "renew")
      await consumeRateLimit(mutationLimiter, composeKey("domain.renew:ip", ctx.ip), "renew.ip")
      await connectDB()

      // 1. Order completed?
      const order = await findCompletedOrderForRenew(ctx.user._id as any, input.orderId)

      // 2. Get renew price
      const tldDoc = await findActiveTldById(order.tldId)
      const renewAmount = Number(tldDoc.renewSold) || 0
      if (renewAmount <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Giá gia hạn không hợp lệ" })
      }

      // 3. Balance check
      await ensureUserHasBalance(ctx.user._id as any, renewAmount)

      // 4. Lock order
      const locked = await lockOrderForRenew(
        ctx.user._id as any,
        order._id.toString(),
        renewAmount
      )
      if (!locked) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Đơn hàng đã thay đổi. Vui lòng tải lại.",
        })
      }

      // 5. CAS deduct balance — rollback nếu fail
      const balance = await deductBalanceAtomic(ctx.user._id as any, renewAmount)
      if (!balance) {
        await unlockRenew(order._id)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Số dư đã thay đổi. Vui lòng thử lại.",
        })
      }

      logBalanceChange({
        userId: ctx.user._id as any,
        moneyBefore: balance.moneyBefore,
        moneyAfter: balance.moneyAfter,
        moneyChange: -renewAmount,
        content: `Gia hạn domain: ${order.domainName}`,
        module: "domain.renew",
        orderId: order._id.toString(),
      })
      void import("@/services/rewards.service").then((m) =>
        m.awardRewardForPurchase({
          userId: ctx.user._id as any,
          vndAmount: renewAmount,
          context: `gia hạn ${order.domainName}`,
          refOrderId: order._id as any,
          refOrderType: "domain.renew",
        })
      )

      if (tldDoc.provider === "spaceship" && tldDoc.autoRenewEnabled) {
        if (!order.expiredAt) {
          logger.warn("renew auto skip: expiredAt null on completed order", {
            module: "domain.router.renew",
            orderId: order._id.toString(),
            domainName: order.domainName,
          })
        } else {
          await completeSpaceshipRenewal({
            orderId: order._id,
            userId: ctx.user._id as any,
            domainName: order.domainName,
            currentExpirationDate: order.expiredAt,
            paidAmount: renewAmount,
          })
        }
      }

      insertLog({
        userId: ctx.user._id,
        action: `Yêu cầu gia hạn domain: ${order.domainName} - ${renewAmount.toLocaleString()}đ`,
        ip: ctx.ip,
        device: ctx.headers.get("user-agent"),
      }).catch(() => {})

      return {
        success: true,
        orderId: order._id.toString(),
        domainName: order.domainName,
        renewAmount,
        message: "Đã gửi yêu cầu gia hạn",
      }
    }),
})
