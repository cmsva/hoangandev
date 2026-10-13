import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Service — Mẫu website (template)
// ============================================================
export interface IService extends Document {
  _id: mongoose.Types.ObjectId
  serviceName: string
  slug: string // URL-friendly, unique
  categoryId: mongoose.Types.ObjectId | null
  image: string | null
  listImage: string[] // gallery
  description: string | null // HTML
  /** URL demo public cho user xem trước */
  demoUrl: string | null
  /** URL admin demo (info gồm tài khoản admin) — chỉ show ở detail public */
  adminDemoUrl: string | null
  /** Danh sách tính năng để render bullet "✓..." */
  featuresList: string[]
  /** Lượt xem (cho ranking) */
  view: number
  /** Số đơn đã thuê (denormalized cho perf) */
  salesCount: number
  /** Thứ tự admin sort thủ công (giống stt logo) */
  stt: number
  status: number // 0 = inactive, 1 = active
  /** URL file zip source dùng riêng cho auto deploy website */
  sourceZipUrl: string | null
  /** Danh sách file config cần thay DB sau khi giải nén */
  configFilePaths: string[]
  /** Danh sách file .sql cần import vào database sau khi giải nén */
  sqlFilePaths: string[]
  /** manual = admin setup, auto = user points NS then system deploys */
  deployMode: "manual" | "auto"
  deployServerId: mongoose.Types.ObjectId | null
  deployCodeId: mongoose.Types.ObjectId | null
  deployPhpVersion: string | null
  deployDefaultAccount: string | null
  deployDefaultPassword: string | null
  createdAt: Date
  updatedAt: Date
}

const serviceSchema = new Schema<IService>(
  {
    serviceName: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 200 },
    categoryId: { type: Schema.Types.ObjectId, ref: "CategoryService", default: null },
    image: { type: String, default: null },
    listImage: { type: [String], default: [] },
    description: { type: String, default: null },
    demoUrl: { type: String, default: null, trim: true },
    adminDemoUrl: { type: String, default: null, trim: true },
    featuresList: { type: [String], default: [] },
    view: { type: Number, default: 0, min: 0 },
    salesCount: { type: Number, default: 0, min: 0 },
    stt: { type: Number, default: 0 },
    status: { type: Number, default: 0 },
    sourceZipUrl: { type: String, default: null, trim: true },
    configFilePaths: { type: [String], default: [".env", "config.php", "cmstdev.php"] },
    sqlFilePaths: { type: [String], default: [] },
    deployMode: { type: String, enum: ["manual", "auto"], default: "manual", index: true },
    deployServerId: { type: Schema.Types.ObjectId, ref: "AaPanelServer", default: null },
    deployCodeId: { type: Schema.Types.ObjectId, ref: "DeployCode", default: null },
    deployPhpVersion: { type: String, default: null, trim: true },
    deployDefaultAccount: { type: String, default: null, trim: true },
    deployDefaultPassword: { type: String, default: null, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

serviceSchema.index({ slug: 1, status: 1 })
serviceSchema.index({ status: 1, stt: 1, createdAt: -1 })
serviceSchema.index({ status: 1, categoryId: 1, stt: 1, createdAt: -1 })
serviceSchema.index({ status: 1, salesCount: -1 })
serviceSchema.index({ status: 1, categoryId: 1, salesCount: -1 })
serviceSchema.index({ status: 1, view: -1 })
serviceSchema.index({ status: 1, categoryId: 1, view: -1 })
serviceSchema.index({ categoryId: 1, status: 1 })
serviceSchema.index({ sourceZipUrl: 1, status: 1 })
// Text search trên serviceName
serviceSchema.index({ serviceName: "text" }, { default_language: "none" })

export const Service = registerModel<IService>("Service", serviceSchema)

// ============================================================
// ServicePricing — Bảng giá theo thời hạn cho mỗi service
// ============================================================
export interface IServicePricing extends Document {
  serviceId: mongoose.Types.ObjectId
  durationMonths: number
  pricePerMonth: number
  priceExtendPerMonth: number
  createdAt: Date
  updatedAt: Date
}

const servicePricingSchema = new Schema<IServicePricing>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    durationMonths: { type: Number, required: true, min: 1 },
    pricePerMonth: { type: Number, required: true, min: 0 },
    priceExtendPerMonth: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

servicePricingSchema.index({ serviceId: 1 })
servicePricingSchema.index({ serviceId: 1, durationMonths: 1 }, { unique: true })

export const ServicePricing = registerModel<IServicePricing>(
  "ServicePricing",
  servicePricingSchema
)

// ============================================================
// OrderService — Đơn thuê website của user
// ============================================================
//
// Status chuẩn (kế thừa pattern logo + có expired vì có duration):
//  - pending          : Đơn mới, admin đang setup
//  - ns_pending       : Auto deploy, chờ user trỏ NS về Cloudflare
//  - processing       : Đã xác nhận NS, worker đang tạo site
//  - active           : Site đã chạy, user truy cập được
//  - expired          : Hết hạn (auto chuyển bởi cron sau expired timestamp)
//  - cancelled        : User/admin hủy không hoàn tiền
//  - cancelled_refund : User hủy lúc pending → hoàn tiền tự động
//  - error_refund     : Admin lỗi setup → hoàn tiền
//  - suspended        : Tạm khóa (vd vi phạm)
export const ORDER_SERVICE_STATUSES = [
  "pending",
  // Auto-deploy lifecycle (mới — user-driven flow)
  "cf_pending",        // Đang tạo Cloudflare zone
  "domain_buying",     // Đang đăng ký domain qua Spaceship (async)
  "domain_failed",     // Spaceship buy fail → admin xem refund
  "ns_pending",        // (legacy) Đã có NS, chờ user trỏ và propagation
  "processing",        // Worker đang deploy (CF zone → aaPanel → ...)
  "failed",            // Worker deploy lỗi → user bấm thử lại / admin review
  // Active lifecycle
  "active",
  "expired",
  "cancelled",
  "cancelled_refund",
  "error_refund",
  "suspended",
] as const
export type OrderServiceStatus = (typeof ORDER_SERVICE_STATUSES)[number]

export interface IOrderService extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  username: string
  serviceId: mongoose.Types.ObjectId
  /** Snapshot tên template tại thời điểm thuê (admin có thể đổi sau) */
  serviceName: string
  serviceSlug: string
  serviceImage: string | null
  amount: number // Giá gốc website (không bao gồm domain TLD)
  /** Giá đăng ký domain (nếu domainNew=true), 0 nếu user tự có */
  domainTldId: mongoose.Types.ObjectId | null
  domainTldName: string | null // "com", "net", "online"...
  domainTldPrice: number
  /** Mã giảm giá đã áp (nếu có) */
  couponCode: string | null
  couponDiscount: number // % discount
  couponDiscountAmount: number // số tiền giảm
  priceExtend: number // Phí gia hạn /tháng (snapshot)
  total: number // Tổng thanh toán cuối (đã trừ coupon, đã cộng domain)
  month: number // Số tháng mua
  /** Tên domain user nhập (free text — không validate) */
  domainName: string
  /** Cờ true nếu user yêu cầu admin mua/đăng ký domain mới giúp */
  domainNew: boolean
  /** Encrypted (AES-GCM): tài khoản shop user nhập để admin setup */
  shopAccountEnc: string | null
  /** Encrypted (AES-GCM): mật khẩu shop */
  shopPasswordEnc: string | null
  adminNote: string | null
  status: OrderServiceStatus
  /** Unix timestamp hết hạn (set khi admin chuyển sang active) */
  expired: number
  panelSiteId: number | null
  deployServerId: mongoose.Types.ObjectId | null
  /** Provisioning state for the new user-driven auto flow (Phase 1 refactor) */
  provisioning?: {
    cloudflareAccountId?: mongoose.Types.ObjectId | null
    cloudflareZoneId?: string | null
    cloudflareRecordId?: string | null
    cloudflareNameServers?: string[]
    spaceshipOperationId?: string | null
    spaceshipPolledAt?: Date | null
    spaceshipAttempts?: number
    spaceshipBoughtAt?: Date | null
    nsActiveAt?: Date | null
    deployStartedAt?: Date | null
    deployCompletedAt?: Date | null
    lastError?: string | null
    stepLog?: Array<{ step: string; status: "pending" | "ok" | "error"; at: Date; note?: string }>
    /**
     * Snapshot tham số deploy — cho phép worker RESUME idempotent giữa các
     * attempt. dbPass random mỗi lần, nếu không lưu thì retry sẽ ghi config DB
     * sai mật khẩu → site lỗi. dbPassEnc mã hoá AES-GCM (credential at-rest).
     */
    deployContext?: {
      serverId?: mongoose.Types.ObjectId | null
      rootPath?: string | null
      dbName?: string | null
      dbUser?: string | null
      dbPassEnc?: string | null
      phpVersion?: string | null
      siteId?: number | null
    } | null
  } | null
  createdAt: Date
  updatedAt: Date
}

const orderServiceSchema = new Schema<IOrderService>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String, required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true, index: true },
    serviceName: { type: String, required: true },
    serviceSlug: { type: String, required: true },
    serviceImage: { type: String, default: null },
    amount: { type: Number, required: true, min: 0 },
    domainTldId: { type: Schema.Types.ObjectId, ref: "DomainTld", default: null },
    domainTldName: { type: String, default: null, lowercase: true, trim: true },
    domainTldPrice: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: null, uppercase: true, trim: true },
    couponDiscount: { type: Number, default: 0, min: 0, max: 100 },
    couponDiscountAmount: { type: Number, default: 0, min: 0 },
    priceExtend: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    month: { type: Number, default: 1, min: 1 },
    domainName: { type: String, required: true, trim: true, maxlength: 253 },
    domainNew: { type: Boolean, default: false },
    shopAccountEnc: { type: String, default: null },
    shopPasswordEnc: { type: String, default: null },
    adminNote: { type: String, default: null, maxlength: 5000 },
    status: {
      type: String,
      enum: ORDER_SERVICE_STATUSES,
      default: "pending",
      index: true,
    },
    expired: { type: Number, default: 0 },
    panelSiteId: { type: Number, default: null },
    deployServerId: { type: Schema.Types.ObjectId, ref: "AaPanelServer", default: null },
    provisioning: {
      type: new Schema(
        {
          cloudflareAccountId: { type: Schema.Types.ObjectId, ref: "CloudflareAccount", default: null },
          cloudflareZoneId: { type: String, default: null, trim: true, maxlength: 191 },
          cloudflareRecordId: { type: String, default: null, trim: true, maxlength: 191 },
          cloudflareNameServers: { type: [String], default: [] },
          spaceshipOperationId: { type: String, default: null, trim: true, maxlength: 191 },
          spaceshipPolledAt: { type: Date, default: null },
          spaceshipAttempts: { type: Number, default: 0, min: 0 },
          spaceshipBoughtAt: { type: Date, default: null },
          nsActiveAt: { type: Date, default: null },
          deployStartedAt: { type: Date, default: null },
          deployCompletedAt: { type: Date, default: null },
          lastError: { type: String, default: null, maxlength: 2000 },
          stepLog: {
            type: [
              {
                _id: false,
                step: { type: String, required: true, maxlength: 50 },
                status: { type: String, enum: ["pending", "ok", "error"], required: true },
                at: { type: Date, default: () => new Date() },
                note: { type: String, default: null, maxlength: 1000 },
              },
            ],
            default: [],
          },
          deployContext: {
            type: new Schema(
              {
                serverId: { type: Schema.Types.ObjectId, ref: "AaPanelServer", default: null },
                rootPath: { type: String, default: null, maxlength: 500 },
                dbName: { type: String, default: null, maxlength: 191 },
                dbUser: { type: String, default: null, maxlength: 191 },
                dbPassEnc: { type: String, default: null, maxlength: 500 },
                phpVersion: { type: String, default: null, maxlength: 10 },
                siteId: { type: Number, default: null },
              },
              { _id: false }
            ),
            default: null,
          },
        },
        { _id: false }
      ),
      // Default object (không phải null) — tránh lỗi Mongo "Cannot create field
      // 'x' in element {provisioning: null}" khi update dot-notation.
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

// ESR — list user's orders sorted by recency
orderServiceSchema.index({ userId: 1, createdAt: -1 })
// Filter status user
orderServiceSchema.index({ userId: 1, status: 1, createdAt: -1 })
orderServiceSchema.index({ userId: 1, total: -1 })
orderServiceSchema.index({ userId: 1, serviceName: 1 })
orderServiceSchema.index({ userId: 1, domainName: 1 })
// Cron expired sweep
orderServiceSchema.index({ status: 1, expired: 1 })
// Cron poll Spaceship buying orders
orderServiceSchema.index({ status: 1, "provisioning.spaceshipPolledAt": 1 })

export const OrderService = registerModel<IOrderService>(
  "OrderService",
  orderServiceSchema
)
