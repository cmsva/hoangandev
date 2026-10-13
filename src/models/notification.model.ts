/**
 * Notification model — thông báo trong app cho user.
 *
 * Source:
 *  - "system": tạo tự động khi business event xảy ra (đăng nhập, đơn hàng, ...)
 *  - "admin":  admin gửi thủ công qua /adminPanel/notifications
 *  - "campaign": từ campaign mail/telegram (lưu vết)
 *
 * Mỗi user có 1 row riêng — broadcast tới nhiều user → fan-out tạo nhiều row.
 * Lý do: đơn giản, query nhanh, dễ track read/unread per user, không phải
 * maintain join table.
 */
import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

export const NOTIFICATION_TYPES = [
  "system",
  "auth",
  "deposit",
  "order",
  "service",
  "ticket",
  "promo",
  "general",
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_SOURCES = ["system", "admin", "campaign"] as const
export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number]

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  type: NotificationType
  source: NotificationSource
  title: string
  /** Nội dung HTML hoặc plain. Render với prose styling. */
  content: string
  /** Link đính kèm khi user bấm vào noti (điều hướng nội bộ). */
  link: string | null
  readAt: Date | null
  createdAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "general" },
    source: { type: String, enum: NOTIFICATION_SOURCES, default: "system" },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    content: { type: String, default: "", maxlength: 50_000 },
    link: { type: String, default: null, maxlength: 500 },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
)

// ESR: equality (userId, readAt) → sort (createdAt desc)
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 })

export const Notification = registerModel<INotification>(
  "Notification",
  notificationSchema
)
