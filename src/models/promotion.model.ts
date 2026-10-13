import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Promotion — Khuyến mãi nạp tiền (collection: promotions)
// ============================================================
export interface IPromotion extends Document {
  amount: number // mức nạp tối thiểu để được bonus
  discount: number // % bonus
}

const promotionSchema = new Schema<IPromotion>(
  {
    amount: { type: Number, required: true },
    discount: { type: Number, required: true },
  },
  { timestamps: false, versionKey: false, collection: "promotions" }
)

promotionSchema.index({ amount: -1 })

export const Promotion = registerModel<IPromotion>("Promotion", promotionSchema)
