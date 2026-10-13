import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Card — Thẻ cào nạp tiền (collection: cards)
// ============================================================
export const CARD_STATUSES = ["pending", "completed", "error"] as const
export type CardStatus = (typeof CARD_STATUSES)[number]

export interface ICard extends Document {
  userId: mongoose.Types.ObjectId
  transId: string
  telco: string
  amount: number // mệnh giá khai báo
  price: number // số tiền thực nhận sau phí
  serial: string
  pin: string
  status: CardStatus
  reason: string | null
  createdAt: Date
  updatedAt: Date
}

const cardSchema = new Schema<ICard>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    transId: { type: String, required: true, unique: true },
    telco: { type: String, required: true },
    amount: { type: Number, required: true },
    price: { type: Number, default: 0 },
    serial: { type: String, required: true },
    pin: { type: String, required: true },
    status: { type: String, enum: CARD_STATUSES, default: "pending" },
    reason: { type: String, default: null },
  },
  { timestamps: true, versionKey: false, collection: "cards" }
)

cardSchema.index({ userId: 1, createdAt: -1 })
cardSchema.index({ serial: 1, pin: 1, status: 1 })

export const Card = registerModel<ICard>("Card", cardSchema)
