import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Log — Lịch sử hoạt động người dùng
// ============================================================
export interface ILog extends Document {
  userId: mongoose.Types.ObjectId
  ip: string | null
  device: string | null
  action: string
  createdAt: Date
}

const logSchema = new Schema<ILog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ip: { type: String, default: null },
    device: { type: String, default: null },
    action: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
)

logSchema.index({ userId: 1, createdAt: -1 })
logSchema.index({ createdAt: -1 })

export const Log = registerModel<ILog>("Log", logSchema)

// ============================================================
// LogBalance — Lịch sử biến động số dư
// ============================================================
export interface ILogBalance extends Document {
  userId: mongoose.Types.ObjectId
  moneyBefore: number
  moneyChange: number
  moneyAfter: number
  content: string
  createdAt: Date
}

const logBalanceSchema = new Schema<ILogBalance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    moneyBefore: { type: Number, required: true },
    moneyChange: { type: Number, required: true },
    moneyAfter: { type: Number, required: true },
    content: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
)

logBalanceSchema.index({ userId: 1, createdAt: -1 })
logBalanceSchema.index({ createdAt: -1 })

export const LogBalance = registerModel<ILogBalance>("LogBalance", logBalanceSchema)
