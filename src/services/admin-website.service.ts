import crypto from "node:crypto"
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { CategoryService } from "@/models/category-service.model"
import { OrderService, Service, ServicePricing, type OrderServiceStatus } from "@/models/service.model"
import { AaPanelServer, CloudflareAccount, DeployCode } from "@/models/website-provisioning.model"
import { decryptValue, encryptValue, maskCredential } from "@/lib/encryption"
import { escapeRegex } from "@/lib/sanitize"
import { aaPanelAddSite, aaPanelApplySsl, aaPanelDecompress, aaPanelDeleteFile, aaPanelDeleteSite, aaPanelGetFile, aaPanelGetRealtimeStats, aaPanelImportSql, aaPanelListDir, aaPanelPing, aaPanelRemoteFileExists, aaPanelRemoteFileSize, aaPanelSaveFile, aaPanelSetFilePermission, aaPanelSetSiteExpiry, aaPanelStartSite, aaPanelStopSite, aaPanelUploadFile, aaPanelUploadLocalFile, validatePanelUrl } from "@/services/aapanel.service"
import { createCloudflareDnsRecord, deleteCloudflareDnsRecord, ensureCloudflareZone, getCloudflareAnalytics, getCloudflareProtectionStatus, getRecordName, getRootDomain, listCloudflareDnsRecords, listCloudflareZones, setCloudflareChallengeMode, setCloudflareRateShield, updateCloudflareDnsRecord, upsertCloudflareARecord, verifyCloudflareToken, type CloudflareAnalyticsRange, type CloudflareDnsRecordInput } from "@/services/cloudflare.service"
import { logger } from "@/lib/logger"
import { emitToUser } from "@/lib/realtime/emit"
import type { DeployStepKey, DeployStepStatus } from "@/services/website-provision.service"
import { deployDebug, deployDebugError, deployDebugSession } from "@/lib/deploy-debug"

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  return new Types.ObjectId(id)
}

function safeDbName(domainName: string): string {
  // MySQL giới hạn user = 32 ký tự, aaPanel/MariaDB nhiều bản còn chặt hơn (~16).
  // Trước đây tên có thể dài tới 41 ký tự → MySQL cắt cụt user khi tạo, nhưng file
  // config lại ghi tên đầy đủ → username trong config ≠ user thật (chỉ password
  // trùng). DB name bị cắt cũng khiến import SQL trỏ sai DB → import thất bại.
  // Giữ tổng ≤ 16 ký tự: "w" + 7 ký tự base + "_" + 4 hex = 13 ký tự. Bắt đầu
  // bằng chữ cái, chỉ [a-z0-9_] để hợp lệ mọi version MySQL/MariaDB.
  const base = domainName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 7) || "site"
  return `w${base}_${crypto.randomBytes(2).toString("hex")}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sourceErrorSummary(error: unknown): string {
  if (error instanceof TRPCError) return error.message
  if (error instanceof Error) return error.message
  return String(error)
}

async function downloadSourceToBuffer(url: string): Promise<Buffer> {
  deployDebug("source", "download via app server", { url })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  let res: Response
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "VankhanhDeployWorker/1.0 (+source-fetch)",
        Accept: "application/zip, application/octet-stream, */*",
      },
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: `Không tải được ZIP: HTTP ${res.status}` })
  }
  const contentLength = Number(res.headers.get("content-length") || 0)
  const maxBytes = 200 * 1024 * 1024
  if (contentLength > maxBytes) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ZIP vượt quá 200MB" })
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > maxBytes) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ZIP vượt quá 200MB" })
  }
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "File tải về không phải ZIP" })
  }
  return buffer
}

/**
 * Cài đặt mã nguồn từ URL ZIP vào rootPath trên server aaPanel (port từ
 * cron-web-create-jobs.php — bản chạy nền nên hỗ trợ tải URL, không sợ timeout).
 *
 * Quy trình bền vững:
 *  1. Convert link Google Drive sang link tải trực tiếp.
 *  2. Gọi aaPanel download API, rồi POLL tồn tại file (tối đa ~10 phút).
 *  3. Nếu API không tải được → fallback wget/curl qua ExecShell, poll tiếp.
 *  4. Giải nén; nếu fail → throw để worker retry/refund.
 *
 * Nếu sourceUrl là path local trên server (không phải http) → giải nén trực tiếp.
 */
async function installSourceFromUrl(
  credentials: { panelUrl: string; apiKey: string },
  rootPath: string,
  sourceUrl: string
): Promise<void> {
  let zipSource = sourceUrl.trim()

  // Path local trên server → giải nén thẳng.
  if (!/^https?:\/\//i.test(zipSource)) {
    const r = (await aaPanelDecompress(credentials, zipSource, rootPath)) as Record<string, unknown>
    if (!r.status) throw new TRPCError({ code: "BAD_GATEWAY", message: `Giải nén source thất bại: ${JSON.stringify(r)}` })
    return
  }

  // Convert Google Drive share link → link tải trực tiếp (hỗ trợ link cũ).
  if (zipSource.includes("drive.google.com")) {
    const m = zipSource.match(/\/file\/d\/([^/]+)/i)
    if (m) zipSource = `https://drive.usercontent.google.com/download?id=${m[1]}&export=download&confirm=t`
  }

  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)
  const rand = crypto.randomBytes(3).toString("hex")
  const remoteZipName = `source_${stamp}_${rand}.zip`
  const uploadedZipRemote = `${rootPath}/${remoteZipName}`

  // Poll: file phải tồn tại VÀ size khớp expectedSize. Nếu không biết size
  // (đường aaPanel-download-API) thì chỉ check tồn tại + size > 0 ổn định 2 lần.
  const waitForZipReady = async (
    tries: number,
    intervalMs: number,
    expectedSize: number | null
  ): Promise<{ ok: boolean; size: number }> => {
    let lastSize = -1
    let stableCount = 0
    for (let i = 0; i < tries; i += 1) {
      const size = await aaPanelRemoteFileSize(credentials, rootPath, remoteZipName)
      if (size > 0) {
        if (expectedSize != null && size === expectedSize) return { ok: true, size }
        if (expectedSize == null) {
          // Không biết size mục tiêu (download API): coi là xong khi size không đổi 2 lần liên tiếp.
          if (size === lastSize) stableCount += 1
          else stableCount = 0
          if (stableCount >= 2) return { ok: true, size }
        }
        lastSize = size
      }
      await sleep(intervalMs)
    }
    return { ok: false, size: lastSize }
  }

  // ─── BƯỚC A: Dọn sạch thư mục site TRƯỚC khi cài source ───
  // aaPanel tự tạo .user.ini/.htaccess/index.html/404.html/502.html khi AddSite
  // → gây rác và conflict khi giải nén. Xóa sạch để dir trống hoàn toàn.
  deployDebug("source", "clean dir trước khi cài source", { dir: rootPath })
  const junkBefore = await aaPanelListDir(credentials, rootPath)
  for (const name of junkBefore) {
    await aaPanelDeleteFile(credentials, `${rootPath}/${name}`).catch(() => {})
  }

  // ─── BƯỚC B: Upload ZIP (chunked) lên dir đã sạch ───
  let directUpload: Record<string, unknown> | null = null
  let directUploadError: string | null = null
  let ready = false
  let expectedSize: number | null = null
  try {
    deployDebug("source", "primary: app-server download → chunked upload", { url: zipSource, dest: uploadedZipRemote })
    const buffer = await downloadSourceToBuffer(zipSource)
    expectedSize = buffer.length
    directUpload = await aaPanelUploadLocalFile(credentials, rootPath, remoteZipName, buffer)
    // Verify size khớp byte → đảm bảo upload đủ trước khi giải nén.
    const verify = await waitForZipReady(30, 1000, expectedSize) // ~30s
    ready = verify.ok
    if (!ready) {
      directUploadError = `Upload xong nhưng size không khớp: server=${verify.size}, expect=${expectedSize}`
      deployDebugError("source", "size mismatch sau upload", null, { expectedSize, serverSize: verify.size })
    }
  } catch (error) {
    directUploadError = sourceErrorSummary(error)
    deployDebugError("source", "primary upload failed", error, { url: zipSource })
  }

  // Fallback: API download của aaPanel (panel tự tải URL, không qua app server).
  if (!ready) {
    deployDebug("source", "fallback aaPanel download API", { url: zipSource })
    let downloadApiError: string | null = null
    const dl = await aaPanelUploadFile(credentials, rootPath, zipSource, remoteZipName).catch((error) => {
      downloadApiError = sourceErrorSummary(error)
      return null
    })
    const verify = await waitForZipReady(40, 3000, null)
    ready = verify.ok
    if (!ready) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `Không tải được ZIP từ ${zipSource}: ${JSON.stringify({
          direct_upload: directUpload ?? directUploadError,
          download_api: dl ?? downloadApiError,
          server_size: verify.size,
          expected_size: expectedSize,
        })}`.slice(0, 500),
      })
    }
  }

  // ─── BƯỚC C: Giải nén (UnZip API trả "succeeded" NGAY nhưng extract chạy NỀN) ───
  // Chụp baseline TRƯỚC khi UnZip để phát hiện file MỚI bung ra (chính là source).
  const baselineNames = new Set(await aaPanelListDir(credentials, rootPath))
  const r = (await aaPanelDecompress(credentials, uploadedZipRemote, rootPath)) as Record<string, unknown>
  if (!r.status) throw new TRPCError({ code: "BAD_GATEWAY", message: `Giải nén ZIP thất bại: ${JSON.stringify(r)}`.slice(0, 500) })

  // ─── BƯỚC D: ĐỢI giải nén THẬT SỰ xong ───
  // UnZip async: poll tới khi xuất hiện file MỚI (ngoài baseline + zip) và số
  // lượng ổn định. Không đợi → xóa zip quá sớm, extract dở dang (bug cũ).
  const waitForExtraction = async (
    tries: number,
    intervalMs: number
  ): Promise<{ ok: boolean; count: number }> => {
    let lastCount = -1
    let stableCount = 0
    for (let i = 0; i < tries; i += 1) {
      await sleep(intervalMs)
      const names = await aaPanelListDir(credentials, rootPath)
      // Đếm entry MỚI: không có trong baseline và không phải file zip đang giải nén.
      const fresh = names.filter((n) => n !== remoteZipName && !baselineNames.has(n)).length
      if (fresh >= 1) {
        if (fresh === lastCount) {
          stableCount += 1
          if (stableCount >= 2) return { ok: true, count: fresh } // ổn định → extract xong
        } else {
          stableCount = 0
        }
        lastCount = fresh
      }
    }
    return { ok: false, count: lastCount }
  }
  const extracted = await waitForExtraction(90, 2000) // tối đa ~3 phút
  if (!extracted.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Giải nén không hoàn tất (file count=${extracted.count}). ZIP đã upload nhưng aaPanel chưa bung xong source.`,
    })
  }
  deployDebug("source", "✅ giải nén hoàn tất", { dir: rootPath, fileCount: extracted.count })

  // ─── BƯỚC E: Xóa ZIP sau khi extract đã xong (best-effort) ───
  await aaPanelDeleteFile(credentials, uploadedZipRemote)
    .then(() => deployDebug("source", "đã xoá file zip sau giải nén", { path: uploadedZipRemote }))
    .catch((error) => deployDebugError("source", "xoá file zip thất bại (bỏ qua)", error, { path: uploadedZipRemote }))
}

export interface ListInput { page: number; limit: number; keyword?: string }
export interface OrderListInput extends ListInput { status?: OrderServiceStatus }

export interface WebsiteProvisionInput {
  sourceZipUrl?: string
  phpVersion?: string
  cloudflareAccountId?: string
  proxied?: boolean
  requireNsActive?: boolean
  /** Bước cuối đã hoàn tất ở attempt trước — deploy sẽ RESUME, bỏ qua bước đã xong. */
  resumeFromStep?: string | null
  /** Callback báo tiến độ từng bước (worker mới truyền vào). Best-effort. */
  onStep?: (
    step: DeployStepKey,
    status: DeployStepStatus,
    note?: string
  ) => void | Promise<void>
}

export interface WebsiteDeployConfigInput {
  deployMode?: "manual" | "auto"
  deployServerId?: string | null
  deployCodeId?: string | null
  deployPhpVersion?: string | null
  deployDefaultAccount?: string | null
  deployDefaultPassword?: string | null
}

export async function listWebsiteCategories(input: ListInput) {
  const skip = (input.page - 1) * input.limit
  const filter = input.keyword ? { name: { $regex: escapeRegex(input.keyword), $options: "i" } } : {}
  const [items, total] = await Promise.all([
    CategoryService.find(filter).sort({ status: -1, name: 1 }).skip(skip).limit(input.limit).lean(),
    CategoryService.countDocuments(filter),
  ])
  return { items: items.map((c: any) => ({ id: String(c._id), name: c.name, slug: c.slug, status: c.status, createdAt: c.createdAt })), total, page: input.page, limit: input.limit, totalPages: Math.max(1, Math.ceil(total / input.limit)) }
}

// No DB cache — luôn fresh. Chỉ giữ inflight de-dupe.
const websiteTemplateListInflight = new Map<string, Promise<Awaited<ReturnType<typeof queryWebsiteTemplates>>>>()

async function queryWebsiteTemplates(input: ListInput) {
  const skip = (input.page - 1) * input.limit
  const filter = input.keyword ? { serviceName: { $regex: escapeRegex(input.keyword), $options: "i" } } : {}
  const [items, total] = await Promise.all([
    Service.find(filter).sort({ stt: 1, createdAt: -1 }).skip(skip).limit(input.limit).select("serviceName slug image status stt categoryId salesCount sourceZipUrl demoUrl adminDemoUrl deployMode deployServerId deployCodeId deployPhpVersion createdAt").populate("categoryId", "name").populate("deployServerId", "name").populate("deployCodeId", "name").lean(),
    Service.countDocuments(filter),
  ])
  return { items: items.map((s: any) => ({ id: String(s._id), serviceName: s.serviceName, slug: s.slug, image: s.image, status: s.status, stt: s.stt, salesCount: s.salesCount, categoryId: s.categoryId?._id ? String(s.categoryId._id) : "", categoryName: s.categoryId?.name ?? "", sourceZipUrl: s.sourceZipUrl ?? "", demoUrl: s.demoUrl ?? "", adminDemoUrl: s.adminDemoUrl ?? "", deployMode: s.deployMode ?? "manual", deployServerId: s.deployServerId?._id ? String(s.deployServerId._id) : "", deployServerName: s.deployServerId?.name ?? "", deployCodeId: s.deployCodeId?._id ? String(s.deployCodeId._id) : "", deployCodeName: s.deployCodeId?.name ?? "", deployPhpVersion: s.deployPhpVersion ?? "80", createdAt: s.createdAt })), total, page: input.page, limit: input.limit, totalPages: Math.max(1, Math.ceil(total / input.limit)) }
}

export async function listWebsiteTemplates(input: ListInput) {
  const key = JSON.stringify(input)
  const inflight = websiteTemplateListInflight.get(key)
  if (inflight) return inflight
  const pending = queryWebsiteTemplates(input).finally(() => websiteTemplateListInflight.delete(key))
  websiteTemplateListInflight.set(key, pending)
  return pending
}

export function invalidateWebsiteTemplateListCache(): void {
  // No-op: không cache nữa. Chỉ clear inflight để an toàn.
  websiteTemplateListInflight.clear()
}

export async function listWebsiteOrders(input: OrderListInput) {
  const skip = (input.page - 1) * input.limit
  const match: Record<string, unknown> = {}
  if (input.status) match.status = input.status
  if (input.keyword) {
    const re = new RegExp(escapeRegex(input.keyword), "i")
    match.$or = [{ domainName: re }, { serviceName: re }, { username: re }]
  }
  const [items, total] = await Promise.all([
    OrderService.find(match).sort({ createdAt: -1 }).skip(skip).limit(input.limit).select("username serviceName domainName total month status expired adminNote createdAt provision").lean(),
    OrderService.countDocuments(match),
  ])
  return { items: items.map((o: any) => ({ id: String(o._id), username: o.username, serviceName: o.serviceName, domainName: o.domainName, total: o.total, month: o.month, status: o.status, expired: o.expired, adminNote: o.adminNote, provision: o.provision ?? null, createdAt: o.createdAt })), total, page: input.page, limit: input.limit, totalPages: Math.max(1, Math.ceil(total / input.limit)) }
}

export interface AaPanelServerInput { name: string; panelUrl: string; apiKey?: string; rootPath: string; dbHost: string; serverIp: string; priority: number; maxSites: number; status: "active" | "disabled"; notes?: string | null }

export async function listAaPanelServers(input: ListInput) {
  const skip = (input.page - 1) * input.limit
  const filter = input.keyword ? { name: { $regex: escapeRegex(input.keyword), $options: "i" } } : {}
  const [items, total] = await Promise.all([
    AaPanelServer.find(filter).sort({ priority: 1, createdAt: -1 }).skip(skip).limit(input.limit).lean(),
    AaPanelServer.countDocuments(filter),
  ])
  return { items: items.map((s: any) => ({ id: String(s._id), name: s.name, panelUrl: s.panelUrl, apiKey: maskCredential(s.apiKeyEnc), rootPath: s.rootPath, dbHost: s.dbHost, serverIp: s.serverIp, priority: s.priority, maxSites: s.maxSites, status: s.status, notes: s.notes, createdAt: s.createdAt })), total, page: input.page, limit: input.limit, totalPages: Math.max(1, Math.ceil(total / input.limit)) }
}

export async function createAaPanelServer(input: AaPanelServerInput) {
  if (!input.apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu API key" })
  const urlCheck = validatePanelUrl(input.panelUrl)
  if (!urlCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: urlCheck.reason })
  const doc = await AaPanelServer.create({ ...input, apiKeyEnc: encryptValue(input.apiKey) })
  return { id: String(doc._id) }
}

export async function updateAaPanelServer(id: string, input: AaPanelServerInput) {
  const urlCheck = validatePanelUrl(input.panelUrl)
  if (!urlCheck.ok) throw new TRPCError({ code: "BAD_REQUEST", message: urlCheck.reason })
  const update: Record<string, unknown> = { ...input }
  delete update.apiKey
  if (input.apiKey) update.apiKeyEnc = encryptValue(input.apiKey)
  await AaPanelServer.updateOne({ _id: toObjectId(id) }, { $set: update })
}

export async function testAaPanelServer(id: string) {
  const server = await AaPanelServer.findById(toObjectId(id)).lean() as any
  if (!server) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy server" })
  const apiKey = decryptValue(server.apiKeyEnc)
  if (!apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu API key" })
  const stats = await aaPanelGetRealtimeStats({ panelUrl: server.panelUrl, apiKey })
  return { success: true, ...stats }
}

export async function deleteAaPanelServer(id: string) {
  await AaPanelServer.deleteOne({ _id: toObjectId(id) })
}

export interface CloudflareInput { name: string; accountId?: string | null; authEmail?: string | null; authMode?: "apiToken" | "globalKey"; apiToken?: string; defaultNs1?: string | null; defaultNs2?: string | null; status: "active" | "disabled"; notes?: string | null }

export async function listCloudflareAccounts(input: ListInput) {
  const skip = (input.page - 1) * input.limit
  const filter = input.keyword ? { name: { $regex: escapeRegex(input.keyword), $options: "i" } } : {}
  const [items, total] = await Promise.all([
    CloudflareAccount.find(filter).sort({ status: 1, name: 1 }).skip(skip).limit(input.limit).lean(),
    CloudflareAccount.countDocuments(filter),
  ])
  return { items: items.map((a: any) => ({ id: String(a._id), name: a.name, accountId: a.accountId, authEmail: a.authEmail ?? null, authMode: a.authMode ?? "globalKey", apiToken: maskCredential(a.apiTokenEnc), defaultNs1: a.defaultNs1 ?? null, defaultNs2: a.defaultNs2 ?? null, status: a.status, notes: a.notes, createdAt: a.createdAt })), total, page: input.page, limit: input.limit, totalPages: Math.max(1, Math.ceil(total / input.limit)) }
}

export async function createCloudflareAccount(input: CloudflareInput) {
  if (!input.apiToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu API token" })
  const doc = await CloudflareAccount.create({ ...input, authMode: input.authMode ?? "globalKey", apiTokenEnc: encryptValue(input.apiToken) })
  return { id: String(doc._id) }
}

export async function updateCloudflareAccount(id: string, input: CloudflareInput) {
  const update: Record<string, unknown> = { ...input }
  delete update.apiToken
  if (input.apiToken) update.apiTokenEnc = encryptValue(input.apiToken)
  await CloudflareAccount.updateOne({ _id: toObjectId(id) }, { $set: update })
}

export async function deleteCloudflareAccount(id: string) {
  await CloudflareAccount.deleteOne({ _id: toObjectId(id) })
}

export async function testCloudflareAccount(id: string) {
  const account = await CloudflareAccount.findById(toObjectId(id)).lean() as any
  if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy Cloudflare" })
  const apiToken = decryptValue(account.apiTokenEnc)
  if (!apiToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu Cloudflare token" })
  await verifyCloudflareToken({ apiToken, authEmail: account.authEmail, authMode: account.authMode ?? "globalKey" })
  return { success: true, message: "API Token hợp lệ" }
}

export async function getWebsiteDeployInfo(orderId: string, userId: Types.ObjectId | string) {
  const order = await OrderService.findOne({ _id: toObjectId(orderId), userId })
    .select("status domainName provision provisioning")
    .lean() as any
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })

  const deployCompletedAt = order.provisioning?.deployCompletedAt ?? null
  const deployStartedAt = order.provisioning?.deployStartedAt ?? null
  const lastError = order.provisioning?.lastError ?? null
  const stepLog = order.provisioning?.stepLog ?? []

  // NS user trỏ về luôn là NS CỐ ĐỊNH (admin cấu hình ở trang Cloudflare).
  // Ưu tiên NS đã lưu trên đơn; nếu trống → đọc NS cố định hiện hành.
  let nameservers: string[] = order.provisioning?.cloudflareNameServers || []
  if (nameservers.length === 0) {
    const account = await CloudflareAccount.findOne({ status: "active" })
      .sort({ createdAt: 1 })
      .select("defaultNs1 defaultNs2")
      .lean() as any
    nameservers = [account?.defaultNs1, account?.defaultNs2].filter(
      (x: unknown): x is string => typeof x === "string" && x.trim().length > 0
    )
  }

  return {
    nameservers,
    status: order.status,
    domain: order.domainName,
    deployStartedAt,
    deployCompletedAt,
    lastError,
    stepLog,
  }
}

/**
 * Thử lại deploy cho đơn `failed` (hoặc legacy ns_pending/cf_pending). Reset về
 * processing và fire worker mới. Worker tự ghi step/emit/telegram.
 */
export async function retryWebsiteDeploy(orderId: string, userId: Types.ObjectId | string) {
  const order = await OrderService.findOne({
    _id: toObjectId(orderId),
    userId,
    status: { $in: ["failed", "ns_pending", "cf_pending"] },
  }).lean() as any
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn cần thử lại" })

  await OrderService.updateOne(
    { _id: order._id },
    { $set: { status: "processing", adminNote: "Đang thử lại tạo tự động...", "provisioning.lastError": null } }
  )
  const { enqueueWebsiteJobForOrder } = await import("@/services/web-job.service")
  await enqueueWebsiteJobForOrder(String(order._id))
  return { success: true, message: "Đang thử lại tạo website" }
}

async function getServerById(id: string) {
  const server = await AaPanelServer.findById(toObjectId(id)).lean() as any
  if (!server || server.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Server aaPanel không khả dụng" })
  const apiKey = decryptValue(server.apiKeyEnc)
  if (!apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu API key aaPanel" })
  await aaPanelPing({ panelUrl: server.panelUrl, apiKey })
  return { server, apiKey }
}

async function pickServer() {
  const servers = await AaPanelServer.find({ status: "active" }).sort({ priority: 1 }).lean() as any[]
  for (const server of servers) {
    const activeCount = await OrderService.countDocuments({ "provision.serverId": server._id, status: { $in: ["pending", "active", "suspended"] } })
    if (server.maxSites > 0 && activeCount >= server.maxSites) continue
    const apiKey = decryptValue(server.apiKeyEnc)
    if (!apiKey) continue
    try {
      await aaPanelPing({ panelUrl: server.panelUrl, apiKey })
      return { server, apiKey }
    } catch {
      continue
    }
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: "Không có aaPanel khả dụng" })
}

export async function provisionWebsiteOrder(orderId: string, input: WebsiteProvisionInput = {}) {
  const order = await OrderService.findById(toObjectId(orderId)).lean() as any
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
  if (!["pending", "ns_pending", "processing", "suspended"].includes(order.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Đơn không thể tạo tự động" })

  const domainNameForLog = String(order.domainName || "").toLowerCase()
  const endSession = deployDebugSession(orderId, domainNameForLog)
  let currentStep: DeployStepKey = "init"

  await OrderService.updateOne({ _id: order._id }, { $set: { adminNote: "Worker đang tạo website tự động" } })

  // Step reporter — best-effort, không bao giờ throw làm hỏng deploy.
  const step = async (
    key: DeployStepKey,
    status: DeployStepStatus,
    note?: string
  ): Promise<void> => {
    currentStep = key
    deployDebug("provision", `step ${key} → ${status}`, { orderId, domain: domainNameForLog, step: key, status, note })
    if (!input.onStep) return
    try {
      await input.onStep(key, status, note)
    } catch {
      /* ignore step reporting errors */
    }
  }

  try {
    const service = (await Service.findById(order.serviceId).select("sourceZipUrl configFilePaths sqlFilePaths deployServerId deployCodeId deployPhpVersion").lean()) as any
    const deployCode = service?.deployCodeId ? await DeployCode.findById(service.deployCodeId).lean() as any : null
    const phpVersion = input.phpVersion ?? service?.deployPhpVersion ?? deployCode?.defaultPhpVersion ?? "80"
    deployDebug("provision", "config resolved", {
      orderId,
      domain: domainNameForLog,
      serviceId: String(order.serviceId || ""),
      hasService: !!service,
      hasDeployCode: !!deployCode,
      phpVersion,
      deployServerId: service?.deployServerId ? String(service.deployServerId) : null,
      sourceZipUrl: input.sourceZipUrl || deployCode?.codeUrl || service?.sourceZipUrl || null,
    })

    // ─── Resume context: tái sử dụng server + dbPass của attempt trước ───────
    // STEP_ORDER giúp biết bước nào đã xong → resume bỏ qua (đặc biệt bước
    // source ~ vài phút). dbPass random mỗi lần nên PHẢI lấy lại từ
    // deployContext khi resume, nếu không config_db sẽ ghi sai mật khẩu DB.
    const STEP_ORDER: DeployStepKey[] = ["init", "aapanel_site", "cloudflare", "source", "config_db", "sql", "ssl", "done"]
    const resumeIdx = input.resumeFromStep ? STEP_ORDER.indexOf(input.resumeFromStep as DeployStepKey) : -1
    const isStepDone = (key: DeployStepKey) => STEP_ORDER.indexOf(key) <= resumeIdx
    const savedCtx = (order.provisioning?.deployContext ?? null) as {
      serverId?: any
      rootPath?: string | null
      dbName?: string | null
      dbUser?: string | null
      dbPassEnc?: string | null
      phpVersion?: string | null
      siteId?: number | null
    } | null
    const canResume = resumeIdx >= 0 && !!savedCtx?.serverId && !!savedCtx?.dbPassEnc

    const domainName = String(order.domainName).toLowerCase()
    let server: any
    let apiKey: string
    let rootPath: string
    let dbName: string
    let dbUser: string
    let dbPass: string
    let effectivePhp: string
    let siteId: number | null = null

    if (canResume) {
      const r = await getServerById(String(savedCtx!.serverId))
      server = r.server
      apiKey = r.apiKey
      rootPath = String(savedCtx!.rootPath || `${server.rootPath.replace(/\/+$/, "")}/${domainName}`)
      dbName = String(savedCtx!.dbName || safeDbName(domainName))
      dbUser = String(savedCtx!.dbUser || dbName)
      dbPass = decryptValue(savedCtx!.dbPassEnc!) || ""
      effectivePhp = savedCtx!.phpVersion || phpVersion
      siteId = savedCtx!.siteId ?? null
      deployDebug("provision", "RESUME từ checkpoint", { orderId, domain: domainName, resumeFrom: input.resumeFromStep, siteId, serverName: server.name })
    } else {
      const picked = service?.deployServerId
        ? await getServerById(String(service.deployServerId))
        : await pickServer()
      server = picked.server
      apiKey = picked.apiKey
      rootPath = `${server.rootPath.replace(/\/+$/, "")}/${domainName}`
      dbName = safeDbName(domainName)
      dbUser = dbName
      dbPass = crypto.randomBytes(12).toString("base64url")
      effectivePhp = phpVersion
      // Lưu deployContext NGAY để retry sau dùng đúng server + dbPass (mã hoá).
      await OrderService.updateOne(
        { _id: order._id },
        {
          $set: {
            "provisioning.deployContext": {
              serverId: server._id,
              rootPath,
              dbName,
              dbUser,
              dbPassEnc: encryptValue(dbPass),
              phpVersion: effectivePhp,
              siteId: null,
            },
          },
        }
      ).catch(() => {})
    }

    const credentials = { panelUrl: server.panelUrl, apiKey }
    deployDebug("provision", "server resolved", {
      orderId,
      domain: domainName,
      serverName: server.name,
      serverIp: server.serverIp,
      rootPath,
      dbName,
      resume: canResume,
    })

    // ─── aaPanel site + DB (bỏ qua nếu đã xong; khoan dung site đã tồn tại) ──
    if (!isStepDone("aapanel_site")) {
      await step("aapanel_site", "pending")
      try {
        const siteResult = await aaPanelAddSite(credentials, { domain: domainName, path: rootPath, phpVersion: effectivePhp, dbName, dbUser, dbPassword: dbPass, note: `Order ${orderId}` })
        siteId = Number((siteResult as any)?.siteId ?? (siteResult as any)?.id ?? 0) || null
      } catch (err) {
        // Site đã tồn tại (attempt trước tạo xong nhưng mất response) → coi như ok,
        // không dựng trùng. siteId có thể null → các bước phụ thuộc tự bỏ qua an toàn.
        const msg = err instanceof Error ? err.message : String(err)
        if (/exist|exists|已存在|已经存在/i.test(msg)) {
          deployDebug("provision", "site đã tồn tại — bỏ qua AddSite", { orderId, domain: domainName, msg })
        } else {
          throw err
        }
      }
      await OrderService.updateOne(
        { _id: order._id },
        { $set: { "provisioning.deployContext.siteId": siteId } }
      ).catch(() => {})
      await step("aapanel_site", "ok", `site ${domainName} + db ${dbName}`)
    }

    // ─── Cloudflare: thêm domain + trỏ A record về IP server (idempotent) ────
    let cf: Record<string, unknown> | null = null
    if (!isStepDone("cloudflare")) {
      const cloudflareAccount = input.cloudflareAccountId
        ? await CloudflareAccount.findById(toObjectId(input.cloudflareAccountId)).lean()
        : await CloudflareAccount.findOne({ status: "active" }).sort({ createdAt: 1 }).lean()
      if (cloudflareAccount) {
        await step("cloudflare", "pending")
        try {
          const account = cloudflareAccount as any
          const apiToken = decryptValue(account.apiTokenEnc)
          if (!apiToken) throw new Error("Thiếu Cloudflare token")
          const rootDomain = getRootDomain(domainName)
          const zone = await ensureCloudflareZone({ apiToken, accountId: account.accountId, authEmail: account.authEmail, authMode: account.authMode ?? "globalKey" }, rootDomain)
          const recordName = getRecordName(domainName, rootDomain)
          const recordId = await upsertCloudflareARecord({ apiToken, authEmail: account.authEmail, authMode: account.authMode ?? "globalKey", zoneId: zone.zoneId, name: recordName, content: server.serverIp, proxied: input.proxied ?? true })
          const { getFixedNameservers } = await import("@/services/website-provision.service")
          const fixedNs = await getFixedNameservers()
          cf = { accountId: account._id, zoneId: zone.zoneId, recordId, nameServers: fixedNs }
          deployDebug("provision", "Cloudflare ok", { orderId, domain: domainName, zoneId: zone.zoneId, recordName, ip: server.serverIp, recordId })
          await step("cloudflare", "ok", `A record ${recordName} → ${server.serverIp}`)
        } catch (err) {
          // PHP không dùng CF — coi đây là tính năng bổ sung, lỗi không block deploy.
          const message = err instanceof Error ? err.message : "Cloudflare lỗi"
          deployDebugError("provision", "Cloudflare step skipped", err, { orderId, domain: domainName })
          logger.warn("Cloudflare step skipped", { module: "admin-website.deploy", domain: domainName, reason: message })
          await step("cloudflare", "error", message.slice(0, 200))
        }
      } else {
        deployDebug("provision", "Không có tài khoản Cloudflare active — bỏ qua bước thêm domain/CF", { orderId, domain: domainName })
      }
    }

    // ─── Source (bước CHẬM nhất; resume bỏ qua nếu đã tải xong) ──────────────
    const sourceZipUrl = input.sourceZipUrl || deployCode?.codeUrl || service?.sourceZipUrl
    if (!isStepDone("source")) {
      if (sourceZipUrl) {
        await step("source", "pending")
        await installSourceFromUrl(credentials, rootPath, String(sourceZipUrl))
        await step("source", "ok")
      } else {
        deployDebug("provision", "no source zip — bỏ qua bước cài source", { orderId, domain: domainName })
      }
    }

    // ─── Config DB ───────────────────────────────────────────────────────────
    let configUpdate: unknown = null
    if (!isStepDone("config_db")) {
      await step("config_db", "pending")
      configUpdate = deployCode?.configFilePath && deployCode?.configTemplate
        ? await writeDeployCodeConfigFile(credentials, rootPath, deployCode, { dbHost: server.dbHost || "127.0.0.1", dbUser, dbPass, dbName })
        : await updateWebsiteDbConfigFiles(credentials, rootPath, service?.configFilePaths, {
          dbHost: server.dbHost || "127.0.0.1",
          dbUser,
          dbPass,
          dbName,
        })
      await step("config_db", "ok")
    }

    // ─── SQL import ──────────────────────────────────────────────────────────
    let sqlImport: unknown = null
    if (!isStepDone("sql")) {
      const sqlOutcome = deployCode?.sqlFilePath
        ? await importWebsiteSqlFiles(credentials, rootPath, [deployCode.sqlFilePath], dbName)
        : await importWebsiteSqlFiles(credentials, rootPath, service?.sqlFilePaths, dbName)
      sqlImport = sqlOutcome.results
      if (sqlOutcome.attempted > 0 && sqlOutcome.failed > 0) {
        // Có file .sql cần import nhưng thất bại → KHÔNG để đơn active với DB rỗng.
        // Đánh dấu step error + throw để worker retry/refund đúng (lỗi #1).
        const detail = sqlOutcome.results.join("; ").slice(0, 400)
        await step("sql", "error", detail)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Import database thất bại: ${detail}`,
        })
      }
      if (sqlOutcome.attempted > 0) {
        await step("sql", "ok")
      }
    }

    // ─── SSL + expiry (cần siteId; resume bỏ qua nếu đã xong) ────────────────
    deployDebug("provision", "site ready", { orderId, domain: domainName, siteId })
    if (siteId && !isStepDone("ssl")) {
      await step("ssl", "pending")
      await aaPanelApplySsl(credentials, domainName, siteId).catch(() => null)
      await step("ssl", "ok")

      // Set ngày hết hạn website trên aaPanel. Format YYYY-MM-DD = today + months.
      const months = Math.max(1, order.month)
      const expiry = new Date()
      expiry.setMonth(expiry.getMonth() + months)
      const ymd = expiry.toISOString().slice(0, 10)
      await aaPanelSetSiteExpiry(credentials, siteId, ymd).catch(() => null)
    }
    await aaPanelSetFilePermission(credentials, rootPath, "www", "755").catch(() => null)

    const expired = Math.floor(Date.now() / 1000) + Math.max(1, order.month) * 30 * 86400
    await OrderService.updateOne({ _id: order._id }, { $set: {
      status: "active",
      expired,
      panelSiteId: siteId,
      deployServerId: server._id,
      adminNote: "Đã tạo website tự động",
      ...(cf?.accountId ? { "provisioning.cloudflareAccountId": cf.accountId } : {}),
      ...(cf?.zoneId ? { "provisioning.cloudflareZoneId": String(cf.zoneId) } : {}),
      ...(cf?.recordId ? { "provisioning.cloudflareRecordId": String(cf.recordId) } : {}),
      ...(cf?.nameServers ? { "provisioning.cloudflareNameServers": cf.nameServers } : {}),
      provision: { serverId: server._id, serverName: server.name, sitePath: rootPath, dbName, dbUser, phpVersion: effectivePhp, configUpdate, sqlImport, cloudflare: cf, provisionedAt: new Date() }
    } })
    // Real-time: báo chủ đơn website đã active (best-effort).
    emitToUser(order.userId, "order:update", { orderId: String(order._id), type: "website", status: "active" })
    endSession("OK", { serverName: server.name })
    return { success: true, message: "Đã tạo website", serverName: server.name, nameServers: (cf?.nameServers as string[] | undefined) ?? [] }
  } catch (err) {
    // Bắt lỗi để ghi rõ bước fail vào file debug, rồi re-throw cho worker xử lý retry/refund.
    deployDebugError("provision", `deploy thất bại tại bước "${currentStep}"`, err, { orderId, domain: domainNameForLog, failedStep: currentStep })
    endSession("FAILED", { failedStep: currentStep, error: err instanceof Error ? err.message : String(err) })
    throw err
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)
}

async function ensureUniqueCategorySlug(slug: string, excludeId?: string): Promise<string> {
  const filter: Record<string, unknown> = { slug }
  if (excludeId) filter._id = { $ne: toObjectId(excludeId) }
  const exists = await CategoryService.findOne(filter).select("_id").lean()
  return exists ? `${slug}-${Date.now().toString(36)}` : slug
}

async function ensureUniqueServiceSlug(slug: string, excludeId?: string): Promise<string> {
  const filter: Record<string, unknown> = { slug }
  if (excludeId) filter._id = { $ne: toObjectId(excludeId) }
  const exists = await Service.findOne(filter).select("_id").lean()
  return exists ? `${slug}-${Date.now().toString(36)}` : slug
}

export interface WebsiteCategoryInput {
  name: string
  slug?: string
  status?: number
}

export async function createWebsiteCategory(input: WebsiteCategoryInput) {
  const slug = await ensureUniqueCategorySlug(slugify(input.slug || input.name))
  const doc = await CategoryService.create({
    name: input.name.trim(),
    slug,
    status: input.status ?? 1,
  })
  return { id: String(doc._id) }
}

export async function updateWebsiteCategory(id: string, input: WebsiteCategoryInput) {
  const update: Record<string, unknown> = {
    name: input.name.trim(),
    status: input.status ?? 1,
  }
  if (input.slug) update.slug = await ensureUniqueCategorySlug(slugify(input.slug), id)
  await CategoryService.updateOne({ _id: toObjectId(id) }, { $set: update })
}

export async function deleteWebsiteCategory(id: string) {
  const _id = toObjectId(id)
  const used = await Service.countDocuments({ categoryId: _id })
  if (used > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Không thể xóa: đang có ${used} mẫu website thuộc danh mục này`,
    })
  }
  await CategoryService.deleteOne({ _id })
}

export async function listWebsiteCategoriesForSelect() {
  const items = await CategoryService.find({}).select("_id name").sort({ name: 1 }).lean()
  return items.map((c: any) => ({ id: String(c._id), name: c.name }))
}

export interface WebsiteTemplateInput {
  serviceName: string
  slug?: string
  categoryId?: string | null
  image?: string | null
  demoUrl?: string | null
  adminDemoUrl?: string | null
  description?: string | null
  status?: number
  stt?: number
}

export async function createWebsiteTemplate(input: WebsiteTemplateInput) {
  const slug = await ensureUniqueServiceSlug(slugify(input.slug || input.serviceName))
  const doc = await Service.create({
    serviceName: input.serviceName.trim(),
    slug,
    categoryId: input.categoryId ? toObjectId(input.categoryId) : null,
    image: input.image ?? null,
    demoUrl: input.demoUrl ?? null,
    adminDemoUrl: input.adminDemoUrl ?? null,
    description: input.description ?? null,
    status: input.status ?? 1,
    stt: input.stt ?? 0,
  })
  return { id: String(doc._id) }
}

export async function updateWebsiteTemplate(id: string, input: WebsiteTemplateInput) {
  const update: Record<string, unknown> = {
    serviceName: input.serviceName.trim(),
    categoryId: input.categoryId ? toObjectId(input.categoryId) : null,
    image: input.image ?? null,
    demoUrl: input.demoUrl ?? null,
    adminDemoUrl: input.adminDemoUrl ?? null,
    description: input.description ?? null,
    status: input.status ?? 1,
    stt: input.stt ?? 0,
  }
  if (input.slug) update.slug = await ensureUniqueServiceSlug(slugify(input.slug), id)
  await Service.updateOne({ _id: toObjectId(id) }, { $set: update })
}

export async function deleteWebsiteTemplate(id: string) {
  const _id = toObjectId(id)
  const sold = await OrderService.countDocuments({ serviceId: _id })
  if (sold > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Không thể xóa mẫu đã có ${sold} đơn. Hãy chuyển sang Ẩn`,
    })
  }
  await Promise.all([
    Service.deleteOne({ _id }),
    ServicePricing.deleteMany({ serviceId: _id }),
  ])
  invalidateWebsiteTemplateListCache()
}

export async function getWebsiteTemplate(id: string) {
  const service = (await Service.findById(toObjectId(id)).lean()) as any
  if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy mẫu website" })
  const pricings = await ServicePricing.find({ serviceId: service._id })
    .select("durationMonths pricePerMonth priceExtendPerMonth")
    .sort({ durationMonths: 1 })
    .lean()
  return {
    id: String(service._id),
    serviceName: service.serviceName,
    slug: service.slug,
    categoryId: service.categoryId ? String(service.categoryId) : "",
    image: service.image ?? null,
    listImage: service.listImage ?? [],
    description: service.description ?? "",
    demoUrl: service.demoUrl ?? "",
    adminDemoUrl: service.adminDemoUrl ?? "",
    featuresList: service.featuresList ?? [],
    sourceZipUrl: service.sourceZipUrl ?? "",
    configFilePaths: service.configFilePaths ?? [".env", "config.php", "cmstdev.php"],
    sqlFilePaths: service.sqlFilePaths ?? [],
    deployMode: service.deployMode ?? "manual",
    deployServerId: service.deployServerId ? String(service.deployServerId) : "",
    deployCodeId: service.deployCodeId ? String(service.deployCodeId) : "",
    deployPhpVersion: service.deployPhpVersion ?? "80",
    deployDefaultAccount: service.deployDefaultAccount ?? "",
    deployDefaultPassword: service.deployDefaultPassword ?? "",
    status: service.status,
    stt: service.stt ?? 0,
    pricings: pricings.map((p: any) => ({
      durationMonths: p.durationMonths,
      pricePerMonth: p.pricePerMonth,
      priceExtendPerMonth: p.priceExtendPerMonth,
    })),
  }
}

export interface WebsitePricingInput {
  durationMonths: number
  pricePerMonth: number
  priceExtendPerMonth: number
}

export interface WebsiteTemplateFullInput extends WebsiteTemplateInput, WebsiteDeployConfigInput {
  listImage?: string[]
  featuresList?: string[]
  sourceZipUrl?: string | null
  configFilePaths?: string[]
  sqlFilePaths?: string[]
  pricings?: WebsitePricingInput[]
}

async function replaceWebsitePricings(serviceId: Types.ObjectId, pricings: WebsitePricingInput[] = []) {
  const docs = pricings
    .filter((p) => p.durationMonths > 0)
    .map((p) => ({
      serviceId,
      durationMonths: Math.floor(p.durationMonths),
      pricePerMonth: Math.max(0, Number(p.pricePerMonth) || 0),
      priceExtendPerMonth: Math.max(0, Number(p.priceExtendPerMonth) || 0),
    }))
  await ServicePricing.deleteMany({ serviceId })
  if (docs.length > 0) await ServicePricing.insertMany(docs)
}

export async function createWebsiteTemplateFull(input: WebsiteTemplateFullInput) {
  const slug = await ensureUniqueServiceSlug(slugify(input.slug || input.serviceName))
  const doc = await Service.create({
    serviceName: input.serviceName.trim(),
    slug,
    categoryId: input.categoryId ? toObjectId(input.categoryId) : null,
    image: input.image ?? null,
    listImage: input.listImage ?? [],
    description: input.description ?? null,
    demoUrl: input.demoUrl ?? null,
    adminDemoUrl: input.adminDemoUrl ?? null,
    featuresList: input.featuresList ?? [],
    sourceZipUrl: input.sourceZipUrl?.trim() || null,
    configFilePaths: input.configFilePaths?.length ? input.configFilePaths : [".env", "config.php", "cmstdev.php"],
    sqlFilePaths: input.sqlFilePaths ?? [],
    deployMode: input.deployMode ?? "manual",
    deployServerId: input.deployServerId ? toObjectId(input.deployServerId) : null,
    deployCodeId: input.deployCodeId ? toObjectId(input.deployCodeId) : null,
    deployPhpVersion: input.deployPhpVersion?.trim() || "80",
    deployDefaultAccount: input.deployDefaultAccount?.trim() || null,
    deployDefaultPassword: input.deployDefaultPassword?.trim() || null,
    status: input.status ?? 1,
    stt: input.stt ?? 0,
  })
  await replaceWebsitePricings(doc._id as Types.ObjectId, input.pricings)
  invalidateWebsiteTemplateListCache()
  return { id: String(doc._id) }
}

export async function updateWebsiteTemplateFull(id: string, input: WebsiteTemplateFullInput) {
  const _id = toObjectId(id)
  const update: Record<string, unknown> = {
    serviceName: input.serviceName.trim(),
    categoryId: input.categoryId ? toObjectId(input.categoryId) : null,
    image: input.image ?? null,
    listImage: input.listImage ?? [],
    description: input.description ?? null,
    demoUrl: input.demoUrl ?? null,
    adminDemoUrl: input.adminDemoUrl ?? null,
    featuresList: input.featuresList ?? [],
    sourceZipUrl: input.sourceZipUrl?.trim() || null,
    configFilePaths: input.configFilePaths?.length ? input.configFilePaths : [".env", "config.php", "cmstdev.php"],
    sqlFilePaths: input.sqlFilePaths ?? [],
    deployMode: input.deployMode ?? "manual",
    deployServerId: input.deployServerId ? toObjectId(input.deployServerId) : null,
    deployCodeId: input.deployCodeId ? toObjectId(input.deployCodeId) : null,
    deployPhpVersion: input.deployPhpVersion?.trim() || "80",
    deployDefaultAccount: input.deployDefaultAccount?.trim() || null,
    deployDefaultPassword: input.deployDefaultPassword?.trim() || null,
    status: input.status ?? 1,
    stt: input.stt ?? 0,
  }
  if (input.slug) update.slug = await ensureUniqueServiceSlug(slugify(input.slug), id)
  await Service.updateOne({ _id }, { $set: update })
  await replaceWebsitePricings(_id, input.pricings)
  invalidateWebsiteTemplateListCache()
}

export async function getWebsiteOrder(id: string) {
  const order = (await OrderService.findById(toObjectId(id)).lean()) as any
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn website" })
  return {
    id: String(order._id),
    username: order.username,
    userId: order.userId ? String(order.userId) : "",
    serviceId: order.serviceId ? String(order.serviceId) : "",
    serviceName: order.serviceName,
    serviceSlug: order.serviceSlug,
    serviceImage: order.serviceImage,
    amount: order.amount,
    domainTldName: order.domainTldName,
    domainTldPrice: order.domainTldPrice,
    couponCode: order.couponCode,
    couponDiscount: order.couponDiscount,
    couponDiscountAmount: order.couponDiscountAmount,
    priceExtend: order.priceExtend,
    total: order.total,
    month: order.month,
    domainName: order.domainName,
    domainNew: order.domainNew,
    adminNote: order.adminNote ?? "",
    status: order.status,
    expired: order.expired,
    provision: order.provision ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

export interface WebsiteOrderUpdateInput {
  status: OrderServiceStatus
  domainName?: string
  total?: number
  month?: number
  expired?: number
  adminNote?: string | null
}

async function getAaPanelCredentialsForOrder(order: any): Promise<{ panelUrl: string; apiKey: string; rootPath: string | null } | null> {
  const deployServerId = order.deployServerId ?? order.provisioning?.deployContext?.serverId
  if (!deployServerId) return null
  const server = await AaPanelServer.findById(deployServerId).select("panelUrl apiKeyEnc rootPath").lean() as any
  const apiKey = server ? decryptValue(server.apiKeyEnc) : ""
  if (!server || !apiKey) return null
  const rootPath = order.provisioning?.deployContext?.rootPath
    ? String(order.provisioning.deployContext.rootPath)
    : order.domainName
      ? `${String(server.rootPath || "/www/wwwroot").replace(/\/+$/, "")}/${String(order.domainName).toLowerCase()}`
      : null
  return { panelUrl: server.panelUrl, apiKey, rootPath }
}

async function startWebsiteIfRenewed(order: any, nextStatus: OrderServiceStatus, nextExpired: number | undefined): Promise<void> {
  const wasExpired = order.status === "expired" || order.status === "suspended"
  const hasFutureExpiry = typeof nextExpired === "number" && nextExpired > Math.floor(Date.now() / 1000)
  if (!wasExpired || nextStatus !== "active" || !hasFutureExpiry || !order.panelSiteId || !order.domainName) return

  const credentials = await getAaPanelCredentialsForOrder(order)
  if (!credentials) return
  await aaPanelStartSite(credentials, Number(order.panelSiteId), String(order.domainName).toLowerCase()).catch((error) => {
    deployDebugError("lifecycle", "start site sau gia hạn thất bại", error, { orderId: String(order._id), domain: order.domainName })
  })
  const ymd = new Date(nextExpired * 1000).toISOString().slice(0, 10)
  await aaPanelSetSiteExpiry(credentials, Number(order.panelSiteId), ymd).catch(() => null)
}

/**
 * Áp side-effect aaPanel sau khi user gia hạn website (lỗi #2).
 * Best-effort: start lại site nếu đã bị stop (do hết hạn) + set ngày hết hạn mới.
 * Không throw — gia hạn (trừ tiền + tăng expired) đã commit ở service layer.
 */
export async function applyWebsiteRenewalSideEffects(
  order: any,
  nextExpired: number
): Promise<void> {
  if (!order?.panelSiteId || !order?.domainName) return
  const credentials = await getAaPanelCredentialsForOrder(order)
  if (!credentials) return

  const siteId = Number(order.panelSiteId)
  const siteName = String(order.domainName).toLowerCase()

  // Nếu site đang bị dừng (đơn expired/suspended) → start lại.
  if (order.status === "expired" || order.status === "suspended") {
    await aaPanelStartSite(credentials, siteId, siteName).catch((error) => {
      deployDebugError("lifecycle", "start site sau gia hạn thất bại", error, {
        orderId: String(order._id),
        domain: siteName,
      })
    })
  }

  const ymd = new Date(nextExpired * 1000).toISOString().slice(0, 10)
  await aaPanelSetSiteExpiry(credentials, siteId, ymd).catch(() => null)
}

async function cleanupWebsiteOrderResources(order: any): Promise<string[]> {
  const logs: string[] = []
  const domainName = String(order.domainName || "").toLowerCase()

  // Cloudflare DNS record cleanup (best-effort). Ưu tiên recordId đã lưu trong provision.
  const cf = order.provision?.cloudflare ?? {}
  const cfAccountId = order.provisioning?.cloudflareAccountId ?? cf.accountId
  const cfZoneId = order.provisioning?.cloudflareZoneId ?? cf.zoneId
  const cfRecordId = order.provisioning?.cloudflareRecordId ?? cf.recordId
  if (cfAccountId && cfZoneId && cfRecordId) {
    try {
      const credentials = await getCloudflareCredentialById(String(cfAccountId))
      await deleteCloudflareDnsRecord({ ...credentials, zoneId: String(cfZoneId), recordId: String(cfRecordId) })
      logs.push("Cloudflare DNS: OK")
    } catch (error) {
      logs.push(`Cloudflare DNS: lỗi ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // aaPanel site + thư mục cleanup (best-effort).
  const credentials = await getAaPanelCredentialsForOrder(order)
  if (credentials && order.panelSiteId && domainName) {
    try {
      await aaPanelDeleteSite(credentials, Number(order.panelSiteId), domainName, credentials.rootPath)
      logs.push("aaPanel site: OK")
    } catch (error) {
      logs.push(`aaPanel site: lỗi ${error instanceof Error ? error.message : String(error)}`)
      if (credentials.rootPath) {
        await aaPanelDeleteFile(credentials, credentials.rootPath)
          .then(() => logs.push("aaPanel path: OK"))
          .catch((pathError) => logs.push(`aaPanel path: lỗi ${pathError instanceof Error ? pathError.message : String(pathError)}`))
      }
    }
  }

  return logs
}

export async function updateWebsiteOrder(id: string, input: WebsiteOrderUpdateInput) {
  const order = await OrderService.findById(toObjectId(id)).lean() as any
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })

  const update: Record<string, unknown> = {
    status: input.status,
    adminNote: input.adminNote ?? null,
  }
  if (input.domainName) update.domainName = input.domainName.trim().toLowerCase()
  if (typeof input.total === "number") update.total = Math.max(0, input.total)
  if (typeof input.month === "number") update.month = Math.max(1, Math.floor(input.month))
  if (typeof input.expired === "number") update.expired = Math.max(0, Math.floor(input.expired))

  await startWebsiteIfRenewed(order, input.status, typeof update.expired === "number" ? update.expired : undefined)
  await OrderService.updateOne({ _id: order._id }, { $set: update })

  // Real-time: báo chủ đơn khi admin đổi trạng thái (best-effort).
  if (order.userId) {
    emitToUser(order.userId, "order:update", { orderId: id, type: "website", status: input.status })
  }

  return {
    ownerId: order.userId ? String(order.userId) : null,
    orderName: order.serviceName || order.domainName || "",
    statusChanged: order.status !== input.status,
    status: input.status,
  }
}

export async function deleteWebsiteOrder(id: string) {
  const order = await OrderService.findById(toObjectId(id)).lean() as any
  if (!order) return { deleted: 0, cleanup: [] as string[] }
  const cleanup = await cleanupWebsiteOrderResources(order)
  const result = await OrderService.deleteOne({ _id: order._id })
  return { deleted: result.deletedCount ?? 0, cleanup }
}

interface DbConfigValues {
  dbHost: string
  dbUser: string
  dbPass: string
  dbName: string
}

function updateEnvConfig(content: string, values: DbConfigValues): { content: string; updated: boolean } {
  const replacements: Array<[RegExp, string]> = [
    [/^DB_HOST\s*=.*$/m, `DB_HOST=${values.dbHost}`],
    [/^DB_USERNAME\s*=.*$/m, `DB_USERNAME=${values.dbUser}`],
    [/^DB_USER\s*=.*$/m, `DB_USER=${values.dbUser}`],
    [/^DB_PASSWORD\s*=.*$/m, `DB_PASSWORD=${values.dbPass}`],
    [/^DB_DATABASE\s*=.*$/m, `DB_DATABASE=${values.dbName}`],
  ]
  let next = content
  let updated = false
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(next)) continue
    next = next.replace(pattern, replacement)
    updated = true
  }
  return { content: next, updated }
}

function updatePhpDbConfig(content: string, values: DbConfigValues): { content: string; updated: boolean } {
  const defineValues: Record<string, string> = {
    DB_HOST: values.dbHost,
    DB_USER: values.dbUser,
    DB_USERNAME: values.dbUser,
    DB_PASS: values.dbPass,
    DB_PASSWORD: values.dbPass,
    DB_NAME: values.dbName,
    DB_DATABASE: values.dbName,
    host: values.dbHost,
    username: values.dbUser,
    password: values.dbPass,
    database: values.dbName,
  }
  let next = content
  let updated = false
  for (const [key, value] of Object.entries(defineValues)) {
    const pattern = new RegExp(`define\\s*\\(\\s*(['"])${key}\\1\\s*,\\s*['"][^'"]*['"]\\s*\\)`, "gi")
    const replaced = next.replace(pattern, `define('${key}', '${value}')`)
    if (replaced !== next) updated = true
    next = replaced
  }
  const mysqliPattern = /mysqli_connect\s*\(\s*(['"])[^'"]*\1\s*,\s*(['"])[^'"]*\2\s*,\s*(['"])[^'"]*\3\s*,\s*(['"])[^'"]*\4\s*\)/gi
  const mysqliReplaced = next.replace(mysqliPattern, `mysqli_connect('${values.dbHost}', '${values.dbUser}', '${values.dbPass}', '${values.dbName}')`)
  if (mysqliReplaced !== next) updated = true
  return { content: mysqliReplaced, updated }
}

async function updateWebsiteDbConfigFiles(
  credentials: { panelUrl: string; apiKey: string },
  rootPath: string,
  configFilePaths: unknown,
  values: DbConfigValues
): Promise<string[]> {
  const paths = Array.isArray(configFilePaths) && configFilePaths.length > 0
    ? configFilePaths.filter((path): path is string => typeof path === "string" && path.trim().length > 0)
    : [".env", "config.php", "cmstdev.php"]
  const results: string[] = []

  for (const relativePath of paths) {
    const cleanPath = relativePath.replace(/^\/+/, "")
    const fullPath = `${rootPath}/${cleanPath}`
    const file = await aaPanelGetFile(credentials, fullPath).catch(() => null)
    const body = typeof file?.data === "string" ? file.data : ""
    if (!body) continue

    const update = cleanPath.endsWith(".env") ? updateEnvConfig(body, values) : updatePhpDbConfig(body, values)
    if (!update.updated) continue

    const saved = await aaPanelSaveFile(credentials, fullPath, update.content).catch(() => null) as { status?: boolean } | null
    results.push(`${cleanPath}: ${saved?.status ? "OK" : "ghi thất bại"}`)
  }

  return results.length > 0 ? results : ["Không tìm thấy DB config cần cập nhật"]
}

export interface SqlImportOutcome {
  results: string[]
  attempted: number
  failed: number
}

async function importWebsiteSqlFiles(
  credentials: { panelUrl: string; apiKey: string },
  rootPath: string,
  sqlFilePaths: unknown,
  dbName: string
): Promise<SqlImportOutcome> {
  const paths = Array.isArray(sqlFilePaths)
    ? sqlFilePaths.filter((path): path is string => typeof path === "string" && path.trim().length > 0)
    : []
  if (paths.length === 0) return { results: [], attempted: 0, failed: 0 }

  const results: string[] = []
  let attempted = 0
  let failed = 0
  for (const relativePath of paths) {
    const cleanPath = relativePath.replace(/^\/+/, "")
    if (!cleanPath.toLowerCase().endsWith(".sql")) {
      results.push(`${cleanPath}: bỏ qua vì không phải .sql`)
      continue
    }
    const fullPath = `${rootPath}/${cleanPath}`
    attempted += 1
    let imported: { status?: boolean; success?: boolean; msg?: string; error?: string } | null = null
    try {
      imported = await aaPanelImportSql(credentials, dbName, fullPath) as { status?: boolean; success?: boolean; msg?: string; error?: string }
    } catch (err) {
      // Trước đây nuốt lỗi bằng .catch(() => null) → import fail âm thầm, đơn vẫn
      // "active" nhưng DB rỗng. Giờ log rõ + đánh dấu failed để caller xử lý.
      deployDebugError("provision", "import SQL thất bại", err, { dbName, fullPath })
      failed += 1
      results.push(`${cleanPath}: ${err instanceof Error ? err.message : "import thất bại"}`)
      continue
    }
    const isOk = imported?.status === true || imported?.success === true
    if (!isOk) failed += 1
    results.push(`${cleanPath}: ${isOk ? "OK" : imported?.msg || imported?.error || "import thất bại"}`)
  }

  return { results, attempted, failed }
}


export interface DeployCodeInput {
  name: string
  codeUrl: string
  configFilePath?: string
  configTemplate?: string
  sqlFilePath?: string
  phpVersions?: string[]
  defaultPhpVersion?: string
  status?: number
}

export async function listDeployCodes(input: ListInput) {
  const skip = (input.page - 1) * input.limit
  const filter = input.keyword ? { name: { $regex: escapeRegex(input.keyword), $options: "i" } } : {}
  const [items, total] = await Promise.all([
    DeployCode.find(filter).sort({ createdAt: -1 }).skip(skip).limit(input.limit).lean(),
    DeployCode.countDocuments(filter),
  ])
  return { items: items.map((d: any) => ({ id: String(d._id), name: d.name, codeUrl: d.codeUrl, configFilePath: d.configFilePath, configTemplate: d.configTemplate, sqlFilePath: d.sqlFilePath, phpVersions: d.phpVersions ?? ["81"], defaultPhpVersion: d.defaultPhpVersion ?? "81", status: d.status ?? 1, createdAt: d.createdAt })), total, page: input.page, limit: input.limit, totalPages: Math.max(1, Math.ceil(total / input.limit)) }
}

export async function createDeployCode(input: DeployCodeInput) {
  const doc = await DeployCode.create({
    name: input.name.trim(),
    codeUrl: input.codeUrl.trim(),
    configFilePath: input.configFilePath?.trim() || ".env",
    configTemplate: input.configTemplate ?? "",
    sqlFilePath: input.sqlFilePath?.trim() || "",
    phpVersions: input.phpVersions?.length ? input.phpVersions : ["81"],
    defaultPhpVersion: input.defaultPhpVersion?.trim() || "81",
    status: input.status ?? 1,
  })
  return { id: String(doc._id) }
}

export async function updateDeployCode(id: string, input: DeployCodeInput) {
  await DeployCode.updateOne({ _id: toObjectId(id) }, { $set: {
    name: input.name.trim(),
    codeUrl: input.codeUrl.trim(),
    configFilePath: input.configFilePath?.trim() || ".env",
    configTemplate: input.configTemplate ?? "",
    sqlFilePath: input.sqlFilePath?.trim() || "",
    phpVersions: input.phpVersions?.length ? input.phpVersions : ["81"],
    defaultPhpVersion: input.defaultPhpVersion?.trim() || "81",
    status: input.status ?? 1,
  } })
}

export async function deleteDeployCode(id: string) {
  await DeployCode.deleteOne({ _id: toObjectId(id) })
}

async function writeDeployCodeConfigFile(
  credentials: { panelUrl: string; apiKey: string },
  rootPath: string,
  deployCode: { configFilePath: string; configTemplate: string },
  values: DbConfigValues
): Promise<string[]> {
  const cleanPath = deployCode.configFilePath.replace(/^\/+/, "")
  const content = deployCode.configTemplate
    .replace(/\{\{DB_HOST\}\}/g, values.dbHost)
    .replace(/\{\{DB_NAME\}\}/g, values.dbName)
    .replace(/\{\{DB_DATABASE\}\}/g, values.dbName)
    .replace(/\{\{DB_USER\}\}/g, values.dbUser)
    .replace(/\{\{DB_USERNAME\}\}/g, values.dbUser)
    .replace(/\{\{DB_PASS\}\}/g, values.dbPass)
    .replace(/\{\{DB_PASSWORD\}\}/g, values.dbPass)
  const saved = await aaPanelSaveFile(credentials, `${rootPath}/${cleanPath}`, content).catch(() => null) as { status?: boolean } | null
  return [`${cleanPath}: ${saved?.status === false ? "ghi thất bại" : "OK"}`]
}


export interface StopExpiredWebsitesInput {
  limit?: number
  now?: number
}

export interface StopExpiredWebsitesResult {
  checked: number
  stopped: number
  failed: number
  skipped: number
  results: Array<{ orderId: string; domainName: string; status: "stopped" | "failed" | "skipped"; message: string }>
}

export async function stopExpiredAutoWebsites(input: StopExpiredWebsitesInput = {}): Promise<StopExpiredWebsitesResult> {
  const now = input.now ?? Math.floor(Date.now() / 1000)
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const orders = (await OrderService.find({
    status: "active",
    expired: { $gt: 0, $lte: now },
    panelSiteId: { $ne: null },
    deployServerId: { $ne: null },
  })
    .select("_id domainName panelSiteId deployServerId expired")
    .sort({ expired: 1 })
    .limit(limit)
    .lean()) as Array<{ _id: Types.ObjectId; domainName: string; panelSiteId: number | null; deployServerId: Types.ObjectId | null }>

  const result: StopExpiredWebsitesResult = { checked: orders.length, stopped: 0, failed: 0, skipped: 0, results: [] }

  for (const order of orders) {
    const orderId = String(order._id)
    const domainName = String(order.domainName || "").toLowerCase()
    if (!order.panelSiteId || !order.deployServerId || !domainName) {
      result.skipped++
      result.results.push({ orderId, domainName, status: "skipped", message: "Thiếu thông tin aaPanel" })
      continue
    }

    try {
      const server = (await AaPanelServer.findById(order.deployServerId).select("panelUrl apiKeyEnc").lean()) as { panelUrl: string; apiKeyEnc: string } | null
      const apiKey = server ? decryptValue(server.apiKeyEnc) : ""
      if (!server || !apiKey) throw new Error("Không tìm thấy server deploy")

      await aaPanelStopSite({ panelUrl: server.panelUrl, apiKey }, order.panelSiteId, domainName)
      await OrderService.updateOne(
        { _id: order._id, status: "active" },
        { $set: { status: "expired", adminNote: "Website đã hết hạn và tự động tạm dừng" } }
      )
      result.stopped++
      result.results.push({ orderId, domainName, status: "stopped", message: "Đã tạm dừng" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tạm dừng thất bại"
      result.failed++
      result.results.push({ orderId, domainName, status: "failed", message })
      logger.error("stop expired website failed", error instanceof Error ? error : { error: message }, {
        module: "website.expired",
        orderId,
        domainName,
      })
      await OrderService.updateOne(
        { _id: order._id },
        { $set: { adminNote: `Lỗi tạm dừng khi hết hạn: ${message.slice(0, 180)}` } }
      ).catch(() => null)
    }
  }

  return result
}

async function getCloudflareCredentialById(id: string) {
  const account = await CloudflareAccount.findById(toObjectId(id)).lean() as any
  if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy Cloudflare" })
  const apiToken = decryptValue(account.apiTokenEnc)
  if (!apiToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Thiếu Cloudflare token" })
  return { account, apiToken, authEmail: account.authEmail ?? null, authMode: account.authMode ?? "globalKey" as const }
}

export async function getCloudflareDashboard(input: { accountId: string; zoneId?: string; range: CloudflareAnalyticsRange }) {
  const credentials = await getCloudflareCredentialById(input.accountId)
  const zones = await listCloudflareZones({ ...credentials, limit: 100 })
  const targetZoneId = input.zoneId ?? zones[0]?.id
  const analytics = targetZoneId
    ? await getCloudflareAnalytics({ ...credentials, zoneIds: [targetZoneId], range: input.range })
    : await getCloudflareAnalytics({ ...credentials, zoneIds: [], range: input.range })
  return { analytics, zones, selectedZoneId: targetZoneId ?? null }
}

export async function listCloudflareAccountZones(input: { accountId: string }) {
  const credentials = await getCloudflareCredentialById(input.accountId)
  return listCloudflareZones({ ...credentials, limit: 100 })
}

export async function listCloudflareZoneDns(input: { accountId: string; zoneId: string }) {
  const credentials = await getCloudflareCredentialById(input.accountId)
  return listCloudflareDnsRecords({ ...credentials, zoneId: input.zoneId })
}

export async function createCloudflareDns(input: { accountId: string; zoneId: string; record: CloudflareDnsRecordInput }) {
  const credentials = await getCloudflareCredentialById(input.accountId)
  return createCloudflareDnsRecord({ ...credentials, zoneId: input.zoneId, record: input.record })
}

export async function updateCloudflareDns(input: { accountId: string; zoneId: string; recordId: string; record: CloudflareDnsRecordInput }) {
  const credentials = await getCloudflareCredentialById(input.accountId)
  return updateCloudflareDnsRecord({ ...credentials, zoneId: input.zoneId, recordId: input.recordId, record: input.record })
}

export async function deleteCloudflareDns(input: { accountId: string; zoneId: string; recordId: string }) {
  const credentials = await getCloudflareCredentialById(input.accountId)
  await deleteCloudflareDnsRecord({ ...credentials, zoneId: input.zoneId, recordId: input.recordId })
  return { success: true }
}

export async function getCloudflareProtection(input: { accountId: string; zoneId: string }) {
  const credentials = await getCloudflareCredentialById(input.accountId)
  return getCloudflareProtectionStatus({ ...credentials, zoneId: input.zoneId })
}

export async function setCloudflareProtection(input: { accountId: string; zoneId: string; mode: "challenge" | "rate"; enabled: boolean }) {
  const credentials = await getCloudflareCredentialById(input.accountId)
  if (input.mode === "challenge") await setCloudflareChallengeMode({ ...credentials, zoneId: input.zoneId, enabled: input.enabled })
  if (input.mode === "rate") await setCloudflareRateShield({ ...credentials, zoneId: input.zoneId, enabled: input.enabled })
  return getCloudflareProtectionStatus({ ...credentials, zoneId: input.zoneId })
}

// ─── Bulk Delete ───
export async function bulkDeleteWebsiteCategories(ids: string[]) {
  const result = await CategoryService.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeleteWebsiteTemplates(ids: string[]) {
  const result = await Service.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeleteWebsiteOrders(ids: string[]) {
  let deleted = 0
  const cleanup: string[] = []
  for (const id of ids) {
    const result = await deleteWebsiteOrder(id)
    deleted += result.deleted
    cleanup.push(...result.cleanup.map((line) => `${id}: ${line}`))
  }
  return { deleted, cleanup }
}

export async function bulkDeleteAaPanelServers(ids: string[]) {
  const result = await AaPanelServer.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeleteCloudflareAccounts(ids: string[]) {
  const result = await CloudflareAccount.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeleteDeployCodes(ids: string[]) {
  const result = await DeployCode.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}
