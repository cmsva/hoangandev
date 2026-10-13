/**
 * web-create-job.model — Layer 1 (Schema only).
 *
 * Hàng đợi bền vững cho việc tạo website tự động. Thực thi do background
 * worker (web-create-worker) thường trú picks — KHÔNG còn gắn với vòng đời
 * request HTTP. Nhờ vậy khách F5 (hoặc tab cron F5) không thể restart hay
 * nhân bản 1 deploy đang chạy.
 *
 * Vòng đời status: pending → running (lease) → done
 *                              ↘ retry (run_after=+60s) → running …
 *                              ↘ failed (sau 3 attempt → refund)
 *
 * Cơ chế lease chống treo vĩnh viễn: worker claim atomic → set leaseUntil +
 * heartbeat. Job `running` với leaseUntil < now ⇒ worker đã chết → sweeper
 * reclaim về retry. Resume theo checkpoint lastStep ⇒ bỏ qua bước đã xong.
 */
import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

export const WEB_JOB_STATUSES = ["pending", "running", "retry", "done", "failed"] as const
export type WebJobStatus = (typeof WEB_JOB_STATUSES)[number]

/** Snapshot dữ liệu cần để deploy — tự chứa, không phụ thuộc state ngoài. */
export interface IWebCreateJobPayload {
  orderId: string
  orderCode: string
  userId: string
  username?: string
  domain: string
  /** Tổng tiền đã trừ — dùng để refund nếu thất bại. */
  totalPrice: number
  [key: string]: unknown
}

export interface IWebCreateJob extends Document {
  _id: mongoose.Types.ObjectId
  orderId: mongoose.Types.ObjectId
  status: WebJobStatus
  attempt: number
  payload: IWebCreateJobPayload
  resultLog: { log?: string[]; warnings?: string[] } | null
  error: string | null
  /** null = chạy ngay; có giá trị = chỉ chạy khi now >= runAfter. */
  runAfter: Date | null
  /**
   * Lease (giữ job) — chống chạy trùng & treo vĩnh viễn.
   * Worker claim job sẽ set leaseUntil = now + LEASE_MS và gia hạn (heartbeat)
   * trong lúc deploy. Job `running` mà leaseUntil < now ⇒ worker đã chết →
   * sweeper reclaim về `retry`.
   */
  leaseUntil: Date | null
  /** Worker đang giữ job (hostname#pid). */
  workerId: string | null
  /** Mốc bắt đầu attempt hiện tại (để hiển thị/giám sát). */
  startedAt: Date | null
  /** Checkpoint: bước deploy cuối đã hoàn tất → resume bỏ qua bước đã xong. */
  lastStep: string | null
  createdAt: Date
  updatedAt: Date
}

const webCreateJobSchema = new Schema<IWebCreateJob>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "OrderService", required: true, index: true },
    status: { type: String, enum: WEB_JOB_STATUSES, default: "pending", index: true },
    attempt: { type: Number, default: 0, min: 0 },
    payload: { type: Schema.Types.Mixed, required: true },
    resultLog: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null, maxlength: 4000 },
    runAfter: { type: Date, default: null },
    leaseUntil: { type: Date, default: null },
    workerId: { type: String, default: null, maxlength: 191 },
    startedAt: { type: Date, default: null },
    lastStep: { type: String, default: null, maxlength: 50 },
  },
  { timestamps: true, versionKey: false }
)

// Cron pick job sẵn sàng (ESR: Equality status → Range runAfter)
webCreateJobSchema.index({ status: 1, runAfter: 1 })
// Sweeper reclaim job kẹt (status running + lease quá hạn)
webCreateJobSchema.index({ status: 1, leaseUntil: 1 })

export const WebCreateJob = registerModel<IWebCreateJob>(
  "WebCreateJob",
  webCreateJobSchema
)
