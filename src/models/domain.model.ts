import mongoose, { Schema, type Document, type Model, type Types } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ─── DomainTld — bảng catalog TLD (com, net, vn, ...) ─────────────────────────
export interface IDomainTld extends Document {
  _id: Types.ObjectId
  tld: string // "com", "net", "vn" — không có dấu chấm đầu
  priceCost: number // giá vốn đăng ký
  renewCost: number // giá vốn gia hạn
  priceSold: number // giá bán user (đăng ký mới)
  renewSold: number // giá bán user (gia hạn)
  provider: "manual" | "spaceship"
  providerTld: string | null
  autoRegisterEnabled: boolean
  autoRenewEnabled: boolean
  markupType: "fixed" | "percent" | null
  markupValue: number
  isActive: boolean // 1=active, 0=disabled
  createdAt: Date
  updatedAt: Date
}

const domainTldSchema = new Schema<IDomainTld>(
  {
    tld: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
    },
    priceCost: { type: Number, default: 0, min: 0 },
    renewCost: { type: Number, default: 0, min: 0 },
    priceSold: { type: Number, default: 0, min: 0 },
    renewSold: { type: Number, default: 0, min: 0 },
    provider: { type: String, enum: ["manual", "spaceship"], default: "manual", index: true },
    providerTld: { type: String, default: null, trim: true, lowercase: true, maxlength: 64 },
    autoRegisterEnabled: { type: Boolean, default: false, index: true },
    autoRenewEnabled: { type: Boolean, default: false },
    markupType: { type: String, enum: ["fixed", "percent", null], default: null },
    markupValue: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "domaintlds" }
)

// ESR: filter active + sort theo giá (cho list)
domainTldSchema.index({ isActive: 1, priceSold: 1 })
// Search theo tld
domainTldSchema.index({ tld: "text" })

export const DomainTld = registerModel<IDomainTld>("DomainTld", domainTldSchema)

// ─── OrderDomain — đơn đăng ký domain của user ────────────────────────────────
export const ORDER_DOMAIN_STATUSES = [
  "pending",
  "completed",
  "renew_pending", // user yêu cầu gia hạn, đợi admin xử lý
  "cancelled",
  "cancelled_refund",
  "error_refund",
  "expired",
  "suspended",
] as const

export type OrderDomainStatus = (typeof ORDER_DOMAIN_STATUSES)[number]

/** Status mà domain coi như "đang chiếm dụng" — chặn user khác đăng ký trùng */
export const ACTIVE_DOMAIN_STATUSES: OrderDomainStatus[] = [
  "pending",
  "completed",
  "renew_pending",
  "suspended",
]

export interface IOrderDomain extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  tldId: Types.ObjectId
  tldName: string // denormalized cho query nhanh
  domainName: string // "abc.com" — lowercase
  ns1: string
  ns2: string
  status: OrderDomainStatus
  provider: "manual" | "spaceship"
  providerStatus: "manual" | "queued" | "processing" | "completed" | "failed"
  providerAsyncOpId: string | null
  providerOrderId: string | null
  providerPayload: Record<string, unknown> | null
  /** Thông tin chủ thể đăng ký (registrant contact) — nhập khi mua miền */
  registrant?: {
    name: string // Tên công ty hoặc cá nhân
    address1: string // Địa chỉ 1
    address2?: string | null // Địa chỉ 2 (tuỳ chọn)
    province: string // Tỉnh thành
    phone: string // Số điện thoại
    zipCode: string // Mã zip/postal code
  } | null
  totalAmount: number
  /** Tổng tiền đã chi cho gia hạn lần cuối — nullable */
  renewAmount?: number | null
  /** Số lần gia hạn thành công */
  renewCount?: number
  expiredAt: Date | null
  adminNote: string | null
  createdAt: Date
  updatedAt: Date
}

const orderDomainSchema = new Schema<IOrderDomain>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tldId: { type: Schema.Types.ObjectId, ref: "DomainTld", required: true },
    tldName: { type: String, required: true, lowercase: true, trim: true },
    domainName: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 253, // RFC max
    },
    ns1: { type: String, default: "", trim: true, maxlength: 253 },
    ns2: { type: String, default: "", trim: true, maxlength: 253 },
    status: {
      type: String,
      enum: ORDER_DOMAIN_STATUSES,
      default: "pending",
      index: true,
    },
    provider: { type: String, enum: ["manual", "spaceship"], default: "manual", index: true },
    providerStatus: { type: String, enum: ["manual", "queued", "processing", "completed", "failed"], default: "manual", index: true },
    providerAsyncOpId: { type: String, default: null, trim: true, maxlength: 255, index: true, sparse: true },
    providerOrderId: { type: String, default: null, trim: true, maxlength: 255 },
    providerPayload: { type: Schema.Types.Mixed, default: null },
    registrant: {
      type: new Schema(
        {
          name: { type: String, default: "", trim: true, maxlength: 191 },
          address1: { type: String, default: "", trim: true, maxlength: 255 },
          address2: { type: String, default: "", trim: true, maxlength: 255 },
          province: { type: String, default: "", trim: true, maxlength: 128 },
          phone: { type: String, default: "", trim: true, maxlength: 32 },
          zipCode: { type: String, default: "", trim: true, maxlength: 16 },
        },
        { _id: false }
      ),
      default: null,
    },
    totalAmount: { type: Number, required: true, min: 0 },
    renewAmount: { type: Number, default: null, min: 0 },
    renewCount: { type: Number, default: 0, min: 0 },
    expiredAt: { type: Date, default: null },
    adminNote: { type: String, default: null, maxlength: 5000 },
  },
  { timestamps: true, collection: "orderdomains" }
)

// ─── Indexes (ESR + race-safe) ────────────────────────────────────────────────
// User's history list — Equality (userId) + Sort (createdAt)
orderDomainSchema.index({ userId: 1, createdAt: -1 })
// User's history filter theo status — Equality (userId, status) + Sort (createdAt)
orderDomainSchema.index({ userId: 1, status: 1, createdAt: -1 })
// Search theo domainName (admin / user)
orderDomainSchema.index({ domainName: 1, status: 1 })
// Cron expired query
orderDomainSchema.index({ status: 1, expiredAt: 1 })

// PARTIAL UNIQUE INDEX — race-safe: 1 domainName chỉ có 1 order ở status active
// Tránh 2 user đăng ký trùng. Cancelled/expired/refund vẫn được đăng ký lại.
orderDomainSchema.index(
  { domainName: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "completed", "renew_pending", "suspended"] },
    },
    name: "uniq_active_domain",
  }
)

export const OrderDomain = registerModel<IOrderDomain>(
  "OrderDomain",
  orderDomainSchema
)

// ─── DomainProviderConfig — cấu hình registrar auto ─────────────────────────
export const DOMAIN_PROVIDER_CONFIG_STATUSES = ["active", "disabled"] as const
export type DomainProviderConfigStatus = (typeof DOMAIN_PROVIDER_CONFIG_STATUSES)[number]

export interface IDomainProviderConfig extends Document {
  _id: Types.ObjectId
  provider: "spaceship"
  name: string
  apiKeyEnc: string
  apiSecretEnc: string
  contactId: string
  autoRegisterEnabled: boolean
  autoRenewEnabled: boolean
  markupType: "fixed" | "percent"
  markupValue: number
  /** Tỉ giá USD→VND để quy đổi giá lấy từ Spaceship (admin nhập tay) */
  usdToVndRate: number
  /** Danh sách TLD slug muốn đồng bộ giá (vd: ["com","net","in_net"]) */
  syncSlugs: string[]
  status: DomainProviderConfigStatus
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

const domainProviderConfigSchema = new Schema<IDomainProviderConfig>(
  {
    provider: { type: String, enum: ["spaceship"], default: "spaceship", unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 191, default: "Spaceship" },
    apiKeyEnc: { type: String, required: true },
    apiSecretEnc: { type: String, required: true },
    contactId: { type: String, required: true, trim: true, maxlength: 191 },
    autoRegisterEnabled: { type: Boolean, default: false, index: true },
    autoRenewEnabled: { type: Boolean, default: false },
    markupType: { type: String, enum: ["fixed", "percent"], default: "fixed" },
    markupValue: { type: Number, default: 0, min: 0 },
    usdToVndRate: { type: Number, default: 26000, min: 1 },
    syncSlugs: { type: [String], default: [] },
    status: { type: String, enum: DOMAIN_PROVIDER_CONFIG_STATUSES, default: "disabled", index: true },
    notes: { type: String, default: null, maxlength: 2000 },
  },
  { timestamps: true, collection: "domainproviderconfigs", versionKey: false }
)

domainProviderConfigSchema.index({ status: 1, provider: 1 })

export const DomainProviderConfig = registerModel<IDomainProviderConfig>(
  "DomainProviderConfig",
  domainProviderConfigSchema
)
