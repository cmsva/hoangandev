import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { Coupon, CouponUsed } from "@/models/coupon.model"

export const COUPON_SCOPES = ["all", "source-code", "website", "domain", "logo", "cronjob"] as const
export type CouponScope = (typeof COUPON_SCOPES)[number]

export interface CouponListInput {
  page: number
  limit: number
  keyword?: string
  scope?: CouponScope
}

export interface CouponWriteInput {
  code: string
  amount: number
  discount: number
  min: number
  max: number
  scope: CouponScope
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "")
}

function assertObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  return new Types.ObjectId(id)
}

function assertCouponInput(input: CouponWriteInput): CouponWriteInput {
  const code = normalizeCode(input.code)
  if (code.length < 3 || code.length > 32) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mã phải từ 3-32 ký tự" })
  }
  if (input.amount < 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Số lượt phải lớn hơn 0" })
  }
  if (input.discount < 0 || input.discount > 100) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "% giảm phải từ 0-100" })
  }
  if (input.max > 0 && input.min > input.max) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Min không được lớn hơn max" })
  }
  return { ...input, code }
}
function serializeCoupon(raw: any) {
  return {
    id: raw._id?.toString?.() ?? String(raw._id ?? ""),
    code: raw.code ?? "",
    amount: raw.amount ?? 0,
    used: raw.used ?? 0,
    discount: raw.discount ?? 0,
    min: raw.min ?? 0,
    max: raw.max ?? 0,
    scope: (raw.scope ?? "all") as CouponScope,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt ?? null,
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : raw.updatedAt ?? null,
  }
}

export async function listAdminCoupons(input: CouponListInput) {
  const page = Math.max(1, input.page)
  const limit = Math.min(100, Math.max(1, input.limit))
  const skip = (page - 1) * limit
  const filter: Record<string, unknown> = {}

  if (input.scope && input.scope !== "all") {
    filter.scope = input.scope
  }
  if (input.keyword?.trim()) {
    const safe = escapeRegex(input.keyword.trim())
    filter.$or = [
      { code: { $regex: safe, $options: "i" } },
      { scope: { $regex: safe, $options: "i" } },
    ]
  }

  const [items, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<any[]>(),
    Coupon.countDocuments(filter),
  ])

  return {
    items: items.map(serializeCoupon),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function createAdminCoupon(input: CouponWriteInput) {
  const payload = assertCouponInput(input)
  const exists = await Coupon.findOne({ code: payload.code }).select("_id").lean()
  if (exists) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mã giảm giá đã tồn tại" })
  }
  const created = await Coupon.create(payload)
  return { success: true, message: "Đã tạo mã giảm giá", item: serializeCoupon(created.toObject()) }
}
export async function updateAdminCoupon(input: CouponWriteInput & { id: string }) {
  const id = assertObjectId(input.id)
  const payload = assertCouponInput(input)
  const duplicate = await Coupon.findOne({ _id: { $ne: id }, code: payload.code }).select("_id").lean()
  if (duplicate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mã giảm giá đã tồn tại" })
  }
  const updated = await Coupon.findOneAndUpdate(
    { _id: id },
    { $set: payload },
    { new: true }
  ).lean<any>()
  if (!updated) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Mã giảm giá không tồn tại" })
  }
  return { success: true, message: "Đã cập nhật mã", item: serializeCoupon(updated) }
}

export async function deleteAdminCoupon(id: string) {
  const couponId = assertObjectId(id)
  const used = await CouponUsed.findOne({ couponId }).select("_id").lean()
  if (used) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mã đã có lịch sử sử dụng" })
  }
  const result = await Coupon.deleteOne({ _id: couponId })
  if (result.deletedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Mã giảm giá không tồn tại" })
  }
  return { success: true, message: "Đã xóa mã giảm giá" }
}

export async function bulkDeleteCoupons(ids: string[]) {
  const objectIds = ids.map((id) => assertObjectId(id))
  const result = await Coupon.deleteMany({ _id: { $in: objectIds } })
  return { deleted: result.deletedCount }
}

