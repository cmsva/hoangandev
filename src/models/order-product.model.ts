import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Order — Lịch sử mua mã nguồn (source code)
// ============================================================
export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId
  productId: mongoose.Types.ObjectId
  totalPrice: number
  orderDate: Date
}

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    totalPrice: { type: Number, default: 0 },
    orderDate: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  }
)

// ESR: Equality (userId) → Sort (orderDate). Phục vụ myOrders query.
orderSchema.index({ userId: 1, orderDate: -1 })
// Unique compound: chặn double-buy ở DB level (defense in depth + race-safe).
orderSchema.index({ userId: 1, productId: 1 }, { unique: true })
// Riêng cho admin/analytics aggregations theo product.
orderSchema.index({ productId: 1, orderDate: -1 })

export const Order = registerModel<IOrder>("Order", orderSchema)
