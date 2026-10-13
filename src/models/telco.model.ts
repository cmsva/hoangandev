import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Telco — Nhà mạng + mệnh giá thẻ cào (collection: telcos)
// ============================================================
export interface ITelco extends Document {
  telco: string
  img: string | null
  value: number // mệnh giá (10000, 20000, ...)
  fees: number // % phí API
  penalty: number // % phạt sai mệnh giá
}

const telcoSchema = new Schema<ITelco>(
  {
    telco: { type: String, required: true },
    img: { type: String, default: null },
    value: { type: Number, required: true },
    fees: { type: Number, default: 0 },
    penalty: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false, collection: "telcos" }
)

telcoSchema.index({ telco: 1, value: 1 })

export const Telco = registerModel<ITelco>("Telco", telcoSchema)
