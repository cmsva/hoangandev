import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

/**
 * CronEngineMetric — heartbeat / load metric do engine ghi định kỳ.
 *
 * Singleton với key = "default". Mỗi lần engine tick cập nhật bằng upsert.
 * Admin có thể đọc để biết engine có alive không, đang xử lý bao nhiêu jobs.
 */
export interface ICronEngineMetric extends Document {
  key: string
  /** PID + hostname để identify instance khi multi-deploy */
  instanceId: string
  alive: boolean
  /** Số job đang chạy (in-flight) */
  inFlight: number
  /** Số job active hiện đang trong DB */
  activeJobsCount: number
  /** Số ping đã thực hiện kể từ start */
  totalPinged: number
  /** Tổng số ping success (2xx) */
  totalSuccess: number
  /** Tổng số ping fail (non-2xx hoặc network err) */
  totalFailed: number
  /** Trung bình duration ms gần đây */
  avgDurationMs: number
  /** Engine khởi động lúc nào */
  startedAt: Date
  /** Tick gần nhất */
  lastTickAt: Date
  /** Số tick từ khi start */
  tickCount: number
  /** Tier auto-tune hiện tại — admin theo dõi */
  tier: {
    tickMs: number
    claimBatch: number
    concurrency: number
  } | null
  updatedAt: Date
}

const cronEngineMetricSchema = new Schema<ICronEngineMetric>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    instanceId: { type: String, required: true },
    alive: { type: Boolean, default: true },
    inFlight: { type: Number, default: 0 },
    activeJobsCount: { type: Number, default: 0 },
    totalPinged: { type: Number, default: 0 },
    totalSuccess: { type: Number, default: 0 },
    totalFailed: { type: Number, default: 0 },
    avgDurationMs: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    lastTickAt: { type: Date, default: Date.now },
    tickCount: { type: Number, default: 0 },
    tier: {
      type: {
        tickMs: Number,
        claimBatch: Number,
        concurrency: Number,
      },
      default: null,
      _id: false,
    },
  },
  { timestamps: true, collection: "cron_engine_metrics" }
)

export const CronEngineMetric = registerModel<ICronEngineMetric>(
  "CronEngineMetric",
  cronEngineMetricSchema
)
