import { z } from "zod"
import { zObjectId, zObjectIdArray } from "@/lib/zod-schemas"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { ORDER_SERVICE_STATUSES } from "@/models/service.model"
import { insertLog } from "@/services/log.service"
import {
  createAaPanelServer,
  createCloudflareAccount,
  createCloudflareDns,
  createDeployCode,
  createWebsiteCategory,
  createWebsiteTemplateFull,
  deleteAaPanelServer,
  deleteCloudflareAccount,
  bulkDeleteWebsiteCategories,
  bulkDeleteWebsiteTemplates,
  bulkDeleteWebsiteOrders,
  bulkDeleteAaPanelServers,
  bulkDeleteCloudflareAccounts,
  bulkDeleteDeployCodes,
  deleteCloudflareDns,
  deleteDeployCode,
  deleteWebsiteCategory,
  deleteWebsiteOrder,
  deleteWebsiteTemplate,
  getCloudflareDashboard,
  getCloudflareProtection,
  getWebsiteOrder,
  getWebsiteTemplate,
  listAaPanelServers,
  listCloudflareAccountZones,
  listCloudflareAccounts,
  listCloudflareZoneDns,
  listDeployCodes,
  listWebsiteCategories,
  listWebsiteCategoriesForSelect,
  listWebsiteOrders,
  listWebsiteTemplates,
  provisionWebsiteOrder,
  setCloudflareProtection,
  testAaPanelServer,
  testCloudflareAccount,
  updateAaPanelServer,
  updateCloudflareAccount,
  updateCloudflareDns,
  updateDeployCode,
  updateWebsiteCategory,
  updateWebsiteOrder,
  updateWebsiteTemplateFull,
} from "@/services/admin-website.service"

const listInput = z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(20), keyword: z.string().trim().max(100).optional() }).strict()
const orderListInput = listInput.extend({ status: z.enum(ORDER_SERVICE_STATUSES).optional() })
const cloudflareRangeInput = z.enum(["24h", "7d", "30d"])
const dnsRecordInput = z.object({
  type: z.enum(["A", "AAAA", "CNAME", "TXT", "MX"]),
  name: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(2000),
  proxied: z.boolean().default(false),
  ttl: z.number().int().min(1).max(86400).default(1),
}).strict()

const categoryInput = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional(),
  status: z.number().int().min(0).max(1).optional(),
}).strict()

const templateInput = z.object({
  serviceName: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional(),
  categoryId: z.string().nullable().optional(),
  image: z.string().trim().max(500).nullable().optional(),
  demoUrl: z.string().trim().max(500).nullable().optional(),
  adminDemoUrl: z.string().trim().max(500).nullable().optional(),
  description: z.string().max(200_000).nullable().optional(),
  status: z.number().int().min(0).max(1).optional(),
  stt: z.number().int().min(0).max(1_000_000).optional(),
}).strict()

const pricingInput = z.object({
  durationMonths: z.number().int().min(1).max(120),
  pricePerMonth: z.number().min(0).max(1_000_000_000),
  priceExtendPerMonth: z.number().min(0).max(1_000_000_000),
}).strict()

const templateFullInput = templateInput.extend({
  listImage: z.array(z.string().trim().max(500)).max(20).default([]),
  featuresList: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  sourceZipUrl: z.string().trim().max(2000).nullable().optional(),
  configFilePaths: z.array(z.string().trim().min(1).max(255)).max(20).default([".env", "config.php", "cmstdev.php"]),
  sqlFilePaths: z.array(z.string().trim().min(1).max(255)).max(20).default([]),
  deployMode: z.enum(["manual", "auto"]).default("manual"),
  deployServerId: z.string().trim().max(64).nullable().optional(),
  deployCodeId: z.string().trim().max(64).nullable().optional(),
  deployPhpVersion: z.string().trim().min(2).max(8).nullable().optional(),
  deployDefaultAccount: z.string().trim().max(191).nullable().optional(),
  deployDefaultPassword: z.string().trim().max(191).nullable().optional(),
  pricings: z.array(pricingInput).min(1).max(20),
}).strict()

const aaPanelInput = z.object({
  name: z.string().trim().min(1).max(191),
  panelUrl: z.string().trim().url().max(255),
  apiKey: z.string().trim().max(255).optional(),
  rootPath: z.string().trim().min(1).max(255).default("/www/wwwroot"),
  dbHost: z.string().trim().min(1).max(191).default("127.0.0.1"),
  serverIp: z.string().trim().min(1).max(64),
  priority: z.number().int().min(0).max(1_000_000).default(100),
  maxSites: z.number().int().min(0).max(1_000_000).default(0),
  status: z.enum(["active", "disabled"]).default("active"),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict()

const deployCodeInput = z.object({
  name: z.string().trim().min(1).max(191),
  codeUrl: z.string().trim().max(2000),
  configFilePath: z.string().trim().max(255).default(".env"),
  configTemplate: z.string().max(100_000).default(""),
  sqlFilePath: z.string().trim().max(255).default(""),
  phpVersions: z.array(z.string().trim().min(2).max(8)).max(20).default(["81"]),
  defaultPhpVersion: z.string().trim().min(2).max(8).default("81"),
  status: z.number().int().min(0).max(1).default(1),
}).strict()

const cloudflareInput = z.object({
  name: z.string().trim().min(1).max(191),
  accountId: z.string().trim().max(191).nullable().optional(),
  authEmail: z.string().trim().email().max(191).nullable().optional(),
  authMode: z.enum(["apiToken", "globalKey"]).default("globalKey"),
  apiToken: z.string().trim().max(512).optional(),
  defaultNs1: z.string().trim().max(191).nullable().optional(),
  defaultNs2: z.string().trim().max(191).nullable().optional(),
  status: z.enum(["active", "disabled"]).default("active"),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict()

export const adminWebsiteRouter = createTRPCRouter({
  listCategories: adminProcedure.input(listInput).query(async ({ input }) => { await connectDB(); return listWebsiteCategories(input) }),
  categoriesForSelect: adminProcedure.query(async () => { await connectDB(); return listWebsiteCategoriesForSelect() }),
  createCategory: adminProcedure.input(categoryInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.cat.create", String(ctx.user._id)), "createWebsiteCategory")
    await connectDB()
    const result = await createWebsiteCategory(input)
    insertLog({ userId: ctx.user._id, action: `Tạo danh mục website "${input.name}"`, ip: ctx.ip }).catch(() => {})
    return result
  }),
  updateCategory: adminProcedure.input(z.object({ id: zObjectId, data: categoryInput }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.cat.update", String(ctx.user._id)), "updateWebsiteCategory")
    await connectDB()
    await updateWebsiteCategory(input.id, input.data)
    insertLog({ userId: ctx.user._id, action: `Cập nhật danh mục website "${input.data.name}"`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),
  deleteCategory: adminProcedure.input(z.object({ id: zObjectId }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.cat.delete", String(ctx.user._id)), "deleteWebsiteCategory")
    await connectDB()
    await deleteWebsiteCategory(input.id)
    return { success: true }
  }),

  listTemplates: adminProcedure.input(listInput).query(async ({ input }) => { await connectDB(); return listWebsiteTemplates(input) }),
  getTemplate: adminProcedure.input(z.object({ id: zObjectId }).strict()).query(async ({ input }) => { await connectDB(); return getWebsiteTemplate(input.id) }),
  createTemplate: adminProcedure.input(templateFullInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.template.create", String(ctx.user._id)), "createWebsiteTemplate")
    await connectDB()
    const result = await createWebsiteTemplateFull(input)
    insertLog({ userId: ctx.user._id, action: `Tạo mẫu website "${input.serviceName}"`, ip: ctx.ip }).catch(() => {})
    return result
  }),
  updateTemplate: adminProcedure.input(z.object({ id: zObjectId, data: templateFullInput }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.template.update", String(ctx.user._id)), "updateWebsiteTemplate")
    await connectDB()
    await updateWebsiteTemplateFull(input.id, input.data)
    insertLog({ userId: ctx.user._id, action: `Cập nhật mẫu website "${input.data.serviceName}"`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),
  deleteTemplate: adminProcedure.input(z.object({ id: zObjectId }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.template.delete", String(ctx.user._id)), "deleteWebsiteTemplate")
    await connectDB()
    await deleteWebsiteTemplate(input.id)
    return { success: true }
  }),

  listOrders: adminProcedure.input(orderListInput).query(async ({ input }) => { await connectDB(); return listWebsiteOrders(input) }),
  getOrder: adminProcedure.input(z.object({ id: zObjectId }).strict()).query(async ({ input }) => { await connectDB(); return getWebsiteOrder(input.id) }),
  updateOrder: adminProcedure.input(z.object({ id: zObjectId, data: z.object({ status: z.enum(ORDER_SERVICE_STATUSES), domainName: z.string().trim().min(3).max(253).optional(), total: z.number().min(0).max(1_000_000_000).optional(), month: z.number().int().min(1).max(120).optional(), expired: z.number().int().min(0).optional(), adminNote: z.string().max(5000).nullable().optional() }).strict() }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.order.update", String(ctx.user._id)), "updateWebsiteOrder")
    await connectDB()
    const res = await updateWebsiteOrder(input.id, input.data)
    insertLog({ userId: ctx.user._id, action: `Cập nhật đơn website (${input.id})`, ip: ctx.ip }).catch(() => {})
    if (res.ownerId && res.statusChanged) {
      void import("@/services/notify.service").then((m) =>
        m.notifyOrderStatus({ userId: res.ownerId!, orderType: "Website", orderName: res.orderName, status: res.status })
      )
    }
    return { success: true }
  }),
  deleteOrder: adminProcedure.input(z.object({ id: zObjectId }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.order.delete", String(ctx.user._id)), "deleteWebsiteOrder")
    await connectDB()
    await deleteWebsiteOrder(input.id)
    insertLog({ userId: ctx.user._id, action: `Xóa đơn website (${input.id})`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),

  listAaPanelServers: adminProcedure.input(listInput).query(async ({ input }) => { await connectDB(); return listAaPanelServers(input) }),
  createAaPanelServer: adminProcedure.input(aaPanelInput.required({ apiKey: true })).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.aapanel.create", String(ctx.user._id)), "createAaPanel")
    await connectDB()
    const result = await createAaPanelServer(input)
    insertLog({ userId: ctx.user._id, action: `Tạo aaPanel ${input.name}`, ip: ctx.ip }).catch(() => {})
    return result
  }),
  updateAaPanelServer: adminProcedure.input(z.object({ id: zObjectId, data: aaPanelInput }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.aapanel.update", String(ctx.user._id)), "updateAaPanel")
    await connectDB()
    await updateAaPanelServer(input.id, input.data)
    insertLog({ userId: ctx.user._id, action: `Cập nhật aaPanel ${input.data.name}`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),
  deleteAaPanelServer: adminProcedure.input(z.object({ id: zObjectId }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.aapanel.delete", String(ctx.user._id)), "deleteAaPanel")
    await connectDB()
    await deleteAaPanelServer(input.id)
    return { success: true }
  }),
  testAaPanelServer: adminProcedure.input(z.object({ id: zObjectId }).strict()).mutation(async ({ input }) => { await connectDB(); return testAaPanelServer(input.id) }),
  getAaPanelServerStatus: adminProcedure.input(z.object({ id: zObjectId }).strict()).query(async ({ input }) => { await connectDB(); return testAaPanelServer(input.id) }),

  listDeployCodes: adminProcedure.input(listInput).query(async ({ input }) => { await connectDB(); return listDeployCodes(input) }),
  createDeployCode: adminProcedure.input(deployCodeInput).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.deployCode.create", String(ctx.user._id)), "createDeployCode")
    await connectDB()
    const result = await createDeployCode(input)
    insertLog({ userId: ctx.user._id, action: `Tạo code deploy ${input.name}`, ip: ctx.ip }).catch(() => {})
    return result
  }),
  updateDeployCode: adminProcedure.input(z.object({ id: zObjectId, data: deployCodeInput }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.deployCode.update", String(ctx.user._id)), "updateDeployCode")
    await connectDB()
    await updateDeployCode(input.id, input.data)
    insertLog({ userId: ctx.user._id, action: `Cập nhật code deploy ${input.data.name}`, ip: ctx.ip }).catch(() => {})
    return { success: true }
  }),
  deleteDeployCode: adminProcedure.input(z.object({ id: zObjectId }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.deployCode.delete", String(ctx.user._id)), "deleteDeployCode")
    await connectDB()
    await deleteDeployCode(input.id)
    return { success: true }
  }),

  listCloudflareAccounts: adminProcedure.input(listInput).query(async ({ input }) => { await connectDB(); return listCloudflareAccounts(input) }),
  createCloudflareAccount: adminProcedure.input(cloudflareInput.required({ apiToken: true })).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.cf.create", String(ctx.user._id)), "createCloudflare")
    await connectDB()
    return createCloudflareAccount(input)
  }),
  updateCloudflareAccount: adminProcedure.input(z.object({ id: zObjectId, data: cloudflareInput }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.cf.update", String(ctx.user._id)), "updateCloudflare")
    await connectDB()
    await updateCloudflareAccount(input.id, input.data)
    return { success: true }
  }),
  deleteCloudflareAccount: adminProcedure.input(z.object({ id: zObjectId }).strict()).mutation(async ({ input }) => { await connectDB(); await deleteCloudflareAccount(input.id); return { success: true } }),
  testCloudflareAccount: adminProcedure.input(z.object({ id: zObjectId }).strict()).mutation(async ({ input }) => { await connectDB(); return testCloudflareAccount(input.id) }),
  getCloudflareDashboard: adminProcedure.input(z.object({ accountId: z.string(), zoneId: z.string().optional(), range: cloudflareRangeInput.default("24h") }).strict()).query(async ({ input }) => { await connectDB(); return getCloudflareDashboard(input) }),
  listCloudflareZones: adminProcedure.input(z.object({ accountId: z.string() }).strict()).query(async ({ input }) => { await connectDB(); return listCloudflareAccountZones(input) }),
  listCloudflareDnsRecords: adminProcedure.input(z.object({ accountId: z.string(), zoneId: z.string() }).strict()).query(async ({ input }) => { await connectDB(); return listCloudflareZoneDns(input) }),
  createCloudflareDnsRecord: adminProcedure.input(z.object({ accountId: z.string(), zoneId: z.string(), record: dnsRecordInput }).strict()).mutation(async ({ input }) => { await connectDB(); return createCloudflareDns(input) }),
  updateCloudflareDnsRecord: adminProcedure.input(z.object({ accountId: z.string(), zoneId: z.string(), recordId: z.string(), record: dnsRecordInput }).strict()).mutation(async ({ input }) => { await connectDB(); return updateCloudflareDns(input) }),
  deleteCloudflareDnsRecord: adminProcedure.input(z.object({ accountId: z.string(), zoneId: z.string(), recordId: z.string() }).strict()).mutation(async ({ input }) => { await connectDB(); return deleteCloudflareDns(input) }),
  getCloudflareProtection: adminProcedure.input(z.object({ accountId: z.string(), zoneId: z.string() }).strict()).query(async ({ input }) => { await connectDB(); return getCloudflareProtection(input) }),
  setCloudflareProtection: adminProcedure.input(z.object({ accountId: z.string(), zoneId: z.string(), mode: z.enum(["challenge", "rate"]), enabled: z.boolean() }).strict()).mutation(async ({ input }) => { await connectDB(); return setCloudflareProtection(input) }),

  provisionOrder: adminProcedure.input(z.object({ orderId: zObjectId, sourceZipUrl: z.string().trim().url().optional(), phpVersion: z.string().trim().min(2).max(8).default("80"), cloudflareAccountId: zObjectId.optional(), proxied: z.boolean().default(false) }).strict()).mutation(async ({ ctx, input }) => {
    await consumeRateLimit(mutationLimiter, composeKey("admin.website.provision", String(ctx.user._id)), "provisionWebsite")
    await connectDB()
    const result = await provisionWebsiteOrder(input.orderId, input)
    insertLog({ userId: ctx.user._id, action: `Tạo website tự động (${input.orderId})`, ip: ctx.ip }).catch(() => {})
    return result
  }),

  bulkDeleteCategories: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.web.cat.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteWebsiteCategories(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} danh mục website`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteTemplates: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.web.tpl.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteWebsiteTemplates(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} template`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteOrders: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.web.order.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteWebsiteOrders(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} đơn website`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteAapanels: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.web.aa.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteAaPanelServers(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} AaPanel`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteCloudflares: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.web.cf.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteCloudflareAccounts(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} Cloudflare`, ip: ctx.ip }).catch(() => {})
      return result
    }),

  bulkDeleteDeployCodes: adminProcedure
    .input(z.object({ ids: zObjectIdArray }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.web.deploy.bulkDel", String(ctx.user._id)), "bulkDel")
      await connectDB()
      const result = await bulkDeleteDeployCodes(input.ids)
      insertLog({ userId: ctx.user._id, action: `Admin bulk xóa ${result.deleted} deploy code`, ip: ctx.ip }).catch(() => {})
      return result
    }),
})
