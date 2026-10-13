/**
 * Campaign models — chiến dịch gửi mail / telegram.
 *
 * Hai collection:
 *  - Campaign: meta + nội dung + lịch gửi
 *  - CampaignRecipient: 1 row / user / campaign — tracking trạng thái gửi
 *
 * Status flow:
 *   draft → queued (admin bấm "Lên lịch")
 *   queued → sending (cron pick lên xử lý)
 *   sending → sent (xong) | failed (lỗi toàn bộ)
 *   draft|queued → cancelled (admin huỷ)
 */
import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

export const CAMPAIGN_TYPES = ["mail", "telegram"] as const
export type CampaignType = (typeof CAMPAIGN_TYPES)[number]

export const CAMPAIGN_STATUSES = [
  "draft",
  "queued",
  "sending",
  "sent",
  "failed",
  "cancelled",
] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const CAMPAIGN_AUDIENCES = ["all", "verified_email", "linked_telegram"] as const
export type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[number]

/** Telegram inline button. */
export interface ITelegramButton {
  text: string
  url: string
}

export interface ICampaign extends Document {
  _id: mongoose.Types.ObjectId
  type: CampaignType
  name: string
  /** Mail: subject; Telegram: tiêu đề nội bộ admin xem (không gửi). */
  subject: string
  /** Mail: HTML body; Telegram: text (HTML parse mode supported). */
  content: string
  /** Telegram only — inline keyboard buttons (1 hàng / nhiều nút). */
  telegramButtons: ITelegramButton[]
  /** Audience filter — bắt buộc verified_email cho mail, linked_telegram cho tele. */
  audience: CampaignAudience
  status: CampaignStatus
  /** Lên lịch gửi. null = gửi ngay khi chuyển sang queued. */
  scheduledAt: Date | null
  /** Set khi cron bắt đầu xử lý. */
  startedAt: Date | null
  /** Set khi xong (status sent/failed). */
  finishedAt: Date | null
  targetCount: number
  sentCount: number
  failedCount: number
  /** Mô tả lỗi global (nếu fail toàn bộ). */
  lastError: string | null
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const telegramButtonSchema = new Schema<ITelegramButton>(
  {
    text: { type: String, required: true, trim: true, maxlength: 64 },
    url: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false }
)

const campaignSchema = new Schema<ICampaign>(
  {
    type: { type: String, enum: CAMPAIGN_TYPES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    subject: { type: String, default: "", trim: true, maxlength: 300 },
    content: { type: String, default: "", maxlength: 50_000 },
    telegramButtons: { type: [telegramButtonSchema], default: [] },
    audience: { type: String, enum: CAMPAIGN_AUDIENCES, required: true },
    status: { type: String, enum: CAMPAIGN_STATUSES, default: "draft", index: true },
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    targetCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    lastError: { type: String, default: null, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false }
)

// Cron picker: status queued + scheduledAt <= now
campaignSchema.index({ status: 1, scheduledAt: 1 })
// Admin list
campaignSchema.index({ type: 1, status: 1, createdAt: -1 })

export const Campaign = registerModel<ICampaign>("Campaign", campaignSchema)

// ─── Recipients ─────────────────────────────────────────────────────────────

export const RECIPIENT_STATUSES = ["pending", "sent", "failed", "skipped"] as const
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number]

export interface ICampaignRecipient extends Document {
  _id: mongoose.Types.ObjectId
  campaignId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  /** Snapshot tại thời điểm queue. Tránh lookup user khi gửi. */
  email: string | null
  telegramId: string | null
  status: RecipientStatus
  attempts: number
  lastError: string | null
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const recipientSchema = new Schema<ICampaignRecipient>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, default: null },
    telegramId: { type: String, default: null },
    status: { type: String, enum: RECIPIENT_STATUSES, default: "pending", index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null, maxlength: 1000 },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

// Cron tick: pick pending của 1 campaign
recipientSchema.index({ campaignId: 1, status: 1 })
// Tránh trùng (1 user / campaign)
recipientSchema.index({ campaignId: 1, userId: 1 }, { unique: true })

export const CampaignRecipient = registerModel<ICampaignRecipient>(
  "CampaignRecipient",
  recipientSchema
)
