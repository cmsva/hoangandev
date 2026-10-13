import mongoose, { Schema, type Document, type Types } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ─── ServerCronjob — bảng catalog "máy chủ" cronjob admin tạo sẵn ────────────
export interface IServerCronjob extends Document {
  _id: Types.ObjectId
  name: string
  price: number // VND/tháng
  usageLimit: number // số job tối đa server này chạy
  currentUsage: number // số job đang dùng (admin/cron tự sync)
  timeloop: number // vòng lặp tối thiểu (s)
  discountPercent: number
  discountValidUntil: Date | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const serverCronjobSchema = new Schema<IServerCronjob>(
  {
    name: { type: String, required: true, trim: true, maxlength: 255 },
    price: { type: Number, required: true, min: 0 },
    usageLimit: { type: Number, required: true, min: 0 },
    currentUsage: { type: Number, default: 0, min: 0 },
    timeloop: { type: Number, default: 30, min: 1 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    discountValidUntil: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "servercronjobs" }
)

// ESR: list active sort by price
serverCronjobSchema.index({ isActive: 1, price: 1 })
serverCronjobSchema.index({ name: 1, isActive: 1 })

export const ServerCronjob = registerModel<IServerCronjob>(
  "ServerCronjob",
  serverCronjobSchema
)

// ─── Cronjob — đơn hàng + job thực tế của user ──────────────────────────────
export const CRONJOB_STATUSES = ["active", "paused", "expired"] as const
export type CronjobStatus = (typeof CRONJOB_STATUSES)[number]

export const HTTP_METHODS = ["GET", "POST"] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export interface ICronjob extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  serverId: Types.ObjectId
  serverName: string // denormalized
  url: string
  method: HttpMethod
  /** Cron tính bằng GIÂY (interval). Nếu cần cron syntax thật sau này có thể chuyển sang string. */
  intervalSeconds: number
  headers: string | null // JSON string user nhập
  body: string | null
  month: number // số tháng user đã mua
  payment: number // tổng tiền đã chi (sau giảm giá)
  status: CronjobStatus
  lastRun: Date | null
  /** Thời điểm engine sẽ ping tiếp theo. Set khi tạo/edit/sau mỗi ping. */
  nextRunAt: Date | null
  expiresAt: Date
  statusCode: number | null // HTTP status của lần chạy gần nhất (0 = network err, 408 = timeout)
  lastResponse: string | null // Snippet response (≤ 1KB)
  lastError: string | null // Last error reason (vd SSRF blocked)
  lastDurationMs: number | null
  createdAt: Date
  updatedAt: Date
}

const cronjobSchema = new Schema<ICronjob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    serverId: { type: Schema.Types.ObjectId, ref: "ServerCronjob", required: true },
    serverName: { type: String, required: true, trim: true, maxlength: 255 },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    method: { type: String, enum: HTTP_METHODS, default: "GET" },
    intervalSeconds: { type: Number, required: true, min: 1, max: 31_536_000 }, // max 1 năm
    headers: { type: String, default: null, maxlength: 8192 },
    body: { type: String, default: null, maxlength: 16384 },
    month: { type: Number, required: true, min: 1, max: 24 },
    payment: { type: Number, required: true, min: 0 },
    status: { type: String, enum: CRONJOB_STATUSES, default: "active", index: true },
    lastRun: { type: Date, default: null },
    nextRunAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
    statusCode: { type: Number, default: null, min: 0, max: 599 },
    lastResponse: { type: String, default: null, maxlength: 2048 },
    lastError: { type: String, default: null, maxlength: 512 },
    lastDurationMs: { type: Number, default: null, min: 0 },
  },
  { timestamps: true, collection: "cronjobs" }
)

// ESR indexes
cronjobSchema.index({ userId: 1, createdAt: -1 })
cronjobSchema.index({ userId: 1, status: 1, createdAt: -1 })
cronjobSchema.index({ userId: 1, expiresAt: -1 })
cronjobSchema.index({ userId: 1, payment: -1 })
// Cron worker: pickup active jobs sắp tới hạn run (engine truy vấn hot-path)
cronjobSchema.index({ status: 1, nextRunAt: 1 })
cronjobSchema.index({ status: 1, expiresAt: 1 })
// Server capacity tracking
cronjobSchema.index({ serverId: 1, status: 1 })

export const Cronjob = registerModel<ICronjob>("Cronjob", cronjobSchema)
