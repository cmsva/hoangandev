/**
 * Campaign service — quản lý chiến dịch mail/telegram.
 *
 * Workflow:
 *  1. createCampaign(input)  → status=draft
 *  2. updateCampaign(id, ...)→ vẫn draft
 *  3. queueCampaign(id, scheduledAt?)
 *      - Materialize recipients từ User filter theo audience
 *      - Set status=queued, scheduledAt
 *  4. (cron) processDueCampaigns()
 *      - Pick mọi campaign queued + scheduledAt ≤ now
 *      - Set status=sending, dispatch batch send
 *      - Khi không còn pending → status=sent
 *  5. cancelCampaign(id) — chỉ cho draft|queued
 *
 * Audience rules:
 *   - mail      → user phải emailVerified=1 (và có email)
 *   - telegram  → user phải có telegramId (đã liên kết)
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { logger } from "@/lib/logger"
import { isValidObjectId } from "@/lib/encryption"
import {
  Campaign,
  CampaignRecipient,
  CAMPAIGN_TYPES,
  CAMPAIGN_AUDIENCES,
  type CampaignType,
  type CampaignAudience,
  type CampaignStatus,
  type ITelegramButton,
} from "@/models/campaign.model"
import { User } from "@/models/user.model"
import { sendRawMail } from "@/lib/send-mail"
import { sendTelegramUserRaw } from "@/lib/send-telegram"
import { getSiteOptions } from "@/models/setting.model"

// ─── Validators ─────────────────────────────────────────────────────────────

const MAX_BUTTONS = 6

function validateAudience(type: CampaignType, audience: CampaignAudience): void {
  // Mail bắt buộc verified_email
  if (type === "mail" && audience !== "verified_email" && audience !== "all") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Chiến dịch mail chỉ chấp nhận audience: verified_email hoặc all",
    })
  }
  if (type === "telegram" && audience !== "linked_telegram" && audience !== "all") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Chiến dịch telegram chỉ chấp nhận audience: linked_telegram hoặc all",
    })
  }
}

function validateContent(type: CampaignType, content: string, subject: string): void {
  if (!content.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Nội dung không được để trống" })
  }
  if (type === "mail" && !subject.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tiêu đề email không được để trống" })
  }
}

function validateButtons(buttons: ITelegramButton[]): void {
  if (!Array.isArray(buttons)) return
  if (buttons.length > MAX_BUTTONS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Tối đa ${MAX_BUTTONS} nút inline`,
    })
  }
  for (const b of buttons) {
    if (!b.text?.trim() || !b.url?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Mỗi nút cần có text + URL" })
    }
    if (!/^https?:\/\//i.test(b.url)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "URL nút phải bắt đầu http(s)://" })
    }
  }
}

// ─── Audience filter ────────────────────────────────────────────────────────

interface AudienceQuery {
  filter: Record<string, unknown>
  projection: Record<string, 1 | 0>
}

function buildAudienceQuery(type: CampaignType, audience: CampaignAudience): AudienceQuery {
  const baseFilter: Record<string, unknown> = { banned: { $ne: 1 } }
  // For mail: bắt buộc emailVerified
  if (type === "mail") {
    baseFilter.emailVerified = 1
    baseFilter.email = { $type: "string", $ne: "" }
  }
  // For telegram: bắt buộc telegramId
  if (type === "telegram") {
    baseFilter.telegramId = { $type: "string", $ne: "" }
  }
  // audience='linked_telegram' on a mail campaign hoặc 'verified_email' on tele
  // đã bị block ở validate. 'all' = giữ baseFilter (vẫn có constraint của type).
  if (audience === "verified_email") {
    baseFilter.emailVerified = 1
    baseFilter.email = { $type: "string", $ne: "" }
  }
  if (audience === "linked_telegram") {
    baseFilter.telegramId = { $type: "string", $ne: "" }
  }
  return {
    filter: baseFilter,
    projection: { _id: 1, email: 1, telegramId: 1 },
  }
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  type: CampaignType
  name: string
  subject: string
  content: string
  audience: CampaignAudience
  telegramButtons?: ITelegramButton[]
  createdBy: Types.ObjectId | string
}

export async function createCampaign(input: CreateCampaignInput) {
  if (!CAMPAIGN_TYPES.includes(input.type)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Loại chiến dịch không hợp lệ" })
  }
  if (!CAMPAIGN_AUDIENCES.includes(input.audience)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Audience không hợp lệ" })
  }
  validateAudience(input.type, input.audience)
  validateContent(input.type, input.content, input.subject)
  if (input.type === "telegram") {
    validateButtons(input.telegramButtons || [])
  }

  const doc = await Campaign.create({
    type: input.type,
    name: input.name.trim(),
    subject: input.subject.trim(),
    content: input.content,
    audience: input.audience,
    telegramButtons: input.type === "telegram" ? input.telegramButtons || [] : [],
    status: "draft" as CampaignStatus,
    createdBy: input.createdBy,
  })
  return doc.toObject()
}

export interface UpdateCampaignInput {
  campaignId: string
  name?: string
  subject?: string
  content?: string
  audience?: CampaignAudience
  telegramButtons?: ITelegramButton[]
}

export async function updateCampaign(input: UpdateCampaignInput) {
  if (!isValidObjectId(input.campaignId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  const camp = (await Campaign.findById(input.campaignId).lean()) as any
  if (!camp) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy chiến dịch" })
  if (camp.status !== "draft") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Chỉ có thể chỉnh sửa khi chiến dịch ở trạng thái Bản nháp",
    })
  }
  const update: Record<string, unknown> = {}
  if (input.name !== undefined) update.name = input.name.trim()
  if (input.subject !== undefined) update.subject = input.subject.trim()
  if (input.content !== undefined) update.content = input.content
  if (input.audience !== undefined) {
    validateAudience(camp.type as CampaignType, input.audience)
    update.audience = input.audience
  }
  if (input.telegramButtons !== undefined && camp.type === "telegram") {
    validateButtons(input.telegramButtons)
    update.telegramButtons = input.telegramButtons
  }
  await Campaign.updateOne({ _id: camp._id }, { $set: update })
  return { success: true }
}

export async function deleteCampaign(campaignId: string) {
  if (!isValidObjectId(campaignId)) return { success: true }
  const camp = (await Campaign.findById(campaignId).lean()) as any
  if (!camp) return { success: true }
  if (camp.status === "sending") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Không thể xoá khi đang gửi. Vui lòng chờ hoàn tất.",
    })
  }
  await Promise.all([
    Campaign.deleteOne({ _id: camp._id }),
    CampaignRecipient.deleteMany({ campaignId: camp._id }),
  ])
  return { success: true }
}

export async function cancelCampaign(campaignId: string) {
  if (!isValidObjectId(campaignId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  const camp = (await Campaign.findById(campaignId).lean()) as any
  if (!camp) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy chiến dịch" })
  if (camp.status !== "draft" && camp.status !== "queued") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Chỉ có thể huỷ khi chiến dịch ở trạng thái Bản nháp hoặc Đã lên lịch",
    })
  }
  await Campaign.updateOne(
    { _id: camp._id },
    { $set: { status: "cancelled", finishedAt: new Date() } }
  )
  return { success: true }
}

// ─── Queue ──────────────────────────────────────────────────────────────────

export async function queueCampaign(campaignId: string, scheduledAt?: Date | null) {
  if (!isValidObjectId(campaignId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  const camp = (await Campaign.findById(campaignId).lean()) as any
  if (!camp) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy chiến dịch" })
  if (camp.status !== "draft") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Chỉ có thể lên lịch khi đang ở trạng thái Bản nháp",
    })
  }

  // Materialize recipients
  const { filter, projection } = buildAudienceQuery(
    camp.type as CampaignType,
    camp.audience as CampaignAudience
  )
  const users = (await User.find(filter, projection).lean()) as Array<{
    _id: Types.ObjectId
    email: string | null
    telegramId: string | null
  }>

  if (users.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Không có người dùng nào khớp với điều kiện audience",
    })
  }

  // Bulk insert (ordered:false để bỏ qua duplicate nếu có)
  const ops = users.map((u) => ({
    insertOne: {
      document: {
        campaignId: camp._id,
        userId: u._id,
        email: camp.type === "mail" ? u.email : null,
        telegramId: camp.type === "telegram" ? u.telegramId : null,
        status: "pending",
        attempts: 0,
      },
    },
  }))
  // Xoá recipients cũ (nếu re-queue draft) — không xảy ra với guard nhưng safe
  await CampaignRecipient.deleteMany({ campaignId: camp._id })
  await CampaignRecipient.bulkWrite(ops, { ordered: false }).catch((err) => {
    logger.warn("queueCampaign bulkWrite partial fail", {
      module: "campaign.queue",
      campaignId: String(camp._id),
      error: err instanceof Error ? err.message : String(err),
    })
  })

  await Campaign.updateOne(
    { _id: camp._id },
    {
      $set: {
        status: "queued",
        scheduledAt: scheduledAt || new Date(),
        targetCount: users.length,
        sentCount: 0,
        failedCount: 0,
        lastError: null,
      },
    }
  )

  return { success: true, targetCount: users.length }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listCampaigns(opts: {
  type?: CampaignType
  status?: CampaignStatus | "all"
  search?: string
  page?: number
  limit?: number
}) {
  const page = Math.max(1, Math.floor(opts.page || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit || 20)))
  const filter: Record<string, unknown> = {}
  if (opts.type) filter.type = opts.type
  if (opts.status && opts.status !== "all") filter.status = opts.status
  if (opts.search?.trim()) {
    const safe = opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    filter.$or = [
      { name: { $regex: safe, $options: "i" } },
      { subject: { $regex: safe, $options: "i" } },
    ]
  }
  const [items, total] = await Promise.all([
    Campaign.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Campaign.countDocuments(filter),
  ])
  return {
    items: (items as any[]).map((it) => ({
      id: String(it._id),
      type: it.type,
      name: it.name,
      subject: it.subject,
      audience: it.audience,
      status: it.status,
      scheduledAt: it.scheduledAt,
      startedAt: it.startedAt,
      finishedAt: it.finishedAt,
      targetCount: it.targetCount,
      sentCount: it.sentCount,
      failedCount: it.failedCount,
      createdAt: it.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function getCampaignDetail(campaignId: string) {
  if (!isValidObjectId(campaignId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  const camp = (await Campaign.findById(campaignId).lean()) as any
  if (!camp) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy chiến dịch" })
  return {
    id: String(camp._id),
    type: camp.type,
    name: camp.name,
    subject: camp.subject,
    content: camp.content,
    telegramButtons: camp.telegramButtons || [],
    audience: camp.audience,
    status: camp.status,
    scheduledAt: camp.scheduledAt,
    startedAt: camp.startedAt,
    finishedAt: camp.finishedAt,
    targetCount: camp.targetCount,
    sentCount: camp.sentCount,
    failedCount: camp.failedCount,
    lastError: camp.lastError,
    createdAt: camp.createdAt,
    updatedAt: camp.updatedAt,
  }
}

/** Estimate audience size khi admin chọn loại + audience (chưa save). */
export async function estimateAudience(input: {
  type: CampaignType
  audience: CampaignAudience
}) {
  validateAudience(input.type, input.audience)
  const { filter } = buildAudienceQuery(input.type, input.audience)
  const count = await User.countDocuments(filter)
  return { count }
}

// ─── Worker: process queued campaigns ───────────────────────────────────────

const BATCH_SIZE = 25 // recipients/loop
const MAX_ATTEMPTS = 3

interface ProcessResult {
  campaignsPicked: number
  campaignsCompleted: number
  totalSent: number
  totalFailed: number
}

/**
 * Cron entry — pick up queued campaigns due (scheduledAt ≤ now) và xử lý.
 * Mỗi lần chạy: process tối đa 1 campaign / tick × BATCH_SIZE recipients.
 *
 * Idempotent: dùng atomic findOneAndUpdate (queued → sending) để không có
 * 2 worker đồng thời pick cùng 1 campaign.
 */
export async function processDueCampaigns(): Promise<ProcessResult> {
  const result: ProcessResult = {
    campaignsPicked: 0,
    campaignsCompleted: 0,
    totalSent: 0,
    totalFailed: 0,
  }

  // 1. Lock 1 campaign queued + scheduledAt due
  const camp = (await Campaign.findOneAndUpdate(
    {
      status: "queued",
      $or: [{ scheduledAt: { $lte: new Date() } }, { scheduledAt: null }],
    },
    { $set: { status: "sending", startedAt: new Date() } },
    { new: true, sort: { scheduledAt: 1, createdAt: 1 } }
  ).lean()) as any

  if (!camp) {
    // Không có campaign mới — xử lý tiếp các đang sending (resume)
    const inProgress = (await Campaign.findOne({ status: "sending" })
      .sort({ startedAt: 1 })
      .lean()) as any
    if (!inProgress) return result
    return await tickCampaign(inProgress)
  }

  result.campaignsPicked = 1
  const tickResult = await tickCampaign(camp)
  result.totalSent += tickResult.totalSent
  result.totalFailed += tickResult.totalFailed
  result.campaignsCompleted += tickResult.campaignsCompleted
  return result
}

async function tickCampaign(camp: { _id: Types.ObjectId; type: CampaignType }): Promise<ProcessResult> {
  const result: ProcessResult = {
    campaignsPicked: 1,
    campaignsCompleted: 0,
    totalSent: 0,
    totalFailed: 0,
  }

  const recipients = (await CampaignRecipient.find({
    campaignId: camp._id,
    status: "pending",
  })
    .limit(BATCH_SIZE)
    .lean()) as any[]

  if (recipients.length === 0) {
    // Campaign hết pending → finalize
    const remaining = await CampaignRecipient.countDocuments({
      campaignId: camp._id,
      status: { $in: ["pending"] },
    })
    if (remaining === 0) {
      const failed = await CampaignRecipient.countDocuments({
        campaignId: camp._id,
        status: "failed",
      })
      const sent = await CampaignRecipient.countDocuments({
        campaignId: camp._id,
        status: "sent",
      })
      const allFailed = sent === 0 && failed > 0
      await Campaign.updateOne(
        { _id: camp._id },
        {
          $set: {
            status: allFailed ? "failed" : "sent",
            finishedAt: new Date(),
            sentCount: sent,
            failedCount: failed,
          },
        }
      )
      result.campaignsCompleted = 1
    }
    return result
  }

  // Reload campaign (để lấy content/subject/buttons mới nhất nếu có)
  const fresh = (await Campaign.findById(camp._id).lean()) as any
  if (!fresh) return result

  for (const r of recipients) {
    const sendResult = await sendOne(fresh, r)
    if (sendResult.success) {
      await CampaignRecipient.updateOne(
        { _id: r._id },
        {
          $set: {
            status: "sent",
            sentAt: new Date(),
            lastError: null,
          },
          $inc: { attempts: 1 },
        }
      )
      result.totalSent++
    } else {
      const newAttempts = (r.attempts || 0) + 1
      const finalStatus = newAttempts >= MAX_ATTEMPTS ? "failed" : "pending"
      await CampaignRecipient.updateOne(
        { _id: r._id },
        {
          $set: {
            status: finalStatus,
            lastError: sendResult.error?.slice(0, 1000) || "Unknown error",
          },
          $inc: { attempts: 1 },
        }
      )
      if (finalStatus === "failed") result.totalFailed++
    }
  }

  // Update counters trên campaign
  await Campaign.updateOne(
    { _id: camp._id },
    { $inc: { sentCount: result.totalSent, failedCount: result.totalFailed } }
  )

  return result
}

/** Build telegram payload (message + reply_markup). */
async function postTelegramWithButtons(
  chatId: string,
  text: string,
  buttons: ITelegramButton[]
): Promise<{ success: boolean; error?: string }> {
  const opts = await getSiteOptions(["telegram_token"])
  const token = opts.telegram_token
  if (!token) return { success: false, error: "Bot token chưa cấu hình" }

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  }
  if (buttons && buttons.length > 0) {
    payload.reply_markup = {
      inline_keyboard: buttons.map((b) => [{ text: b.text, url: b.url }]),
    }
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: text }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}

async function sendOne(
  camp: any,
  r: any
): Promise<{ success: boolean; error?: string }> {
  if (camp.type === "mail") {
    if (!r.email) return { success: false, error: "Recipient không có email" }
    return await sendRawMail(r.email, camp.subject, camp.content)
  }
  if (camp.type === "telegram") {
    if (!r.telegramId) return { success: false, error: "Recipient chưa liên kết telegram" }
    if (camp.telegramButtons && camp.telegramButtons.length > 0) {
      return await postTelegramWithButtons(r.telegramId, camp.content, camp.telegramButtons)
    }
    return await sendTelegramUserRaw(r.telegramId, camp.content)
  }
  return { success: false, error: "Loại chiến dịch không hỗ trợ" }
}
