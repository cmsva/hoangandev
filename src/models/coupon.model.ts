import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Coupon — Mã giảm giá
// ============================================================
export interface ICoupon extends Document {
  code: string
  amount: number // Số lượng mã còn lại
  used: number // Số lần đã dùng
  discount: number // % giảm giá (0-100)
  min: number // Đơn hàng tối thiểu
  max: number // Đơn hàng tối đa
  scope: string // all | source-code | website | domain | logo | cronjob
  createdAt: Date
  updatedAt: Date
}

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    amount: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    min: { type: Number, default: 1000 },
    max: { type: Number, default: 10000000 },
    scope: { type: String, default: "all", enum: ["all", "source-code", "website", "domain", "logo", "cronjob"], index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

couponSchema.index({ scope: 1, code: 1 })

export const Coupon = registerModel<ICoupon>("Coupon", couponSchema)

// ============================================================
// CouponUsed — Lịch sử sử dụng mã giảm giá
// ============================================================
export interface ICouponUsed extends Document {
  couponId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  transId: string | null
  createdAt: Date
}

const couponUsedSchema = new Schema<ICouponUsed>(
  {
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    transId: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
)

// Unique compound: mỗi user chỉ dùng 1 mã 1 lần (DB-level defense)
couponUsedSchema.index({ couponId: 1, userId: 1 }, { unique: true })
// Reverse lổ để query tất cả coupon mà user đã dùng
couponUsedSchema.index({ userId: 1, createdAt: -1 })

export const CouponUsed = registerModel<ICouponUsed>("CouponUsed", couponUsedSchema)
