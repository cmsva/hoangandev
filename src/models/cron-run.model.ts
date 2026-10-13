import { Schema, type Document, type Types } from "mongoose"
import { registerModel } from "@/lib/register-model"

/**
 * CronRun — lưu trạng thái lần chạy cuối của mỗi cron job vào MongoDB.
 *
 * Mỗi cron endpoint có 1 document (key unique). Khi cron chạy, ghi đè
 * lastRunAt + lastStatus + duration + message. Dùng cho tab giám sát
 * Cronjob trong admin settings (không phụ thuộc Redis).
 */
export const CRON_RUN_STATUSES = ["success", "error"] as const
export type CronRunStatus = (typeof CRON_RUN_STATUSES)[number]

export interface ICronRun extends Document {
  _id: Types.ObjectId
  key: string
  lastRunAt: Date
  lastStatus: CronRunStatus
  lastDurationMs: number
  lastMessage: string
  runCount: number
  createdAt: Date
  updatedAt: Date
}

const cronRunSchema = new Schema<ICronRun>(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 64 },
    lastRunAt: { type: Date, required: true },
    lastStatus: { type: String, enum: CRON_RUN_STATUSES, default: "success" },
    lastDurationMs: { type: Number, default: 0, min: 0 },
    lastMessage: { type: String, default: "", maxlength: 500 },
    runCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: "cronruns", versionKey: false }
)

export const CronRun = registerModel<ICronRun>("CronRun", cronRunSchema)
