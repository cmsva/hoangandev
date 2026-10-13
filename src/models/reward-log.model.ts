/**
 * Reward Log model — Lịch sử điểm thưởng (earn / redeem).
 *
 * Mỗi giao dịch điểm thưởng tạo 1 bản ghi:
 *  - earn   : nhận điểm khi mua dịch vụ (positive change)
 *  - redeem : đổi điểm sang số dư (negative change)
 */
import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

export const REWARD_LOG_TYPES = ["earn", "redeem"] as const
export type RewardLogType = (typeof REWARD_LOG_TYPES)[number]

export interface IRewardLog extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  type: RewardLogType
  /** Giá trị thay đổi (dương cho earn, âm cho redeem). */
  pointsChange: number
  /** Số dư điểm sau khi giao dịch áp dụng. */
  pointsAfter: number
  /** Số tiền liên quan: với earn = giá đơn; với redeem = số dư VNĐ cộng vào. */
  vndAmount: number
  /** Mô tả ngắn — ví dụ "Thưởng từ đơn website ABC", "Đổi 500 điểm = 50.000đ". */
  content: string
  /** Liên kết đến đơn nguồn (nếu earn). */
  refOrderId?: mongoose.Types.ObjectId | null
  refOrderType?: string | null
  createdAt: Date
}

const rewardLogSchema = new Schema<IRewardLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: REWARD_LOG_TYPES, required: true },
    pointsChange: { type: Number, required: true },
    pointsAfter: { type: Number, required: true },
    vndAmount: { type: Number, default: 0 },
    content: { type: String, required: true },
    refOrderId: { type: Schema.Types.ObjectId, default: null },
    refOrderType: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
)

// ESR: equality (userId) → sort (createdAt desc)
rewardLogSchema.index({ userId: 1, createdAt: -1 })
rewardLogSchema.index({ userId: 1, type: 1, createdAt: -1 })

export const RewardLog = registerModel<IRewardLog>("RewardLog", rewardLogSchema)
