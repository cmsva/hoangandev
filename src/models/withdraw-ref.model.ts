/**
 * WithdrawRef model — Yêu cầu rút tiền hoa hồng (affiliate).
 *
 * status:
 *  - 0 = pending (chờ admin duyệt — bank transfer)
 *  - 1 = completed (auto-approved khi rút về số dư hệ thống)
 *  - 2 = rejected (admin từ chối / hệ thống từ chối)
 *
 * `bank = "BALANCE"` đại diện rút về số dư chính.
 */
import mongoose, { Schema, type Document } from "mongoose"

export const WITHDRAW_REF_STATUSES = ["pending", "completed", "rejected"] as const
export type WithdrawRefStatus = (typeof WITHDRAW_REF_STATUSES)[number]

export interface IWithdrawRef extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  transId: string
  /** "BALANCE" hoặc bank shortName (eg. VCB, MBB, ...) */
  bank: string
  stk: string
  name: string
  amount: number
  /** 0=pending, 1=completed, 2=rejected */
  status: number
  reason: string | null
  createdAt: Date
  updatedAt: Date
}

const withdrawRefSchema = new Schema<IWithdrawRef>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transId: { type: String, required: true, unique: true, trim: true },
    bank: { type: String, required: true, trim: true },
    stk: { type: String, default: "" },
    name: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },
    status: { type: Number, default: 0, index: true },
    reason: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
)

// ESR: Equality (userId) → Sort (createdAt desc)
withdrawRefSchema.index({ userId: 1, createdAt: -1 })
// Index riêng cho admin filter status (eg. list pending)
withdrawRefSchema.index({ status: 1, createdAt: -1 })

export const WithdrawRef =
  (mongoose.models.WithdrawRef as mongoose.Model<IWithdrawRef>) ||
  mongoose.model<IWithdrawRef>("WithdrawRef", withdrawRefSchema)
