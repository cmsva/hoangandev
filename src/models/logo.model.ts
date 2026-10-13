import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// CategoryLogo — Danh mục logo
// SQL: category_logo (id, name, slug, status, created_at)
// ============================================================
export interface ICategoryLogo extends Document {
  name: string
  slug: string
  status: number // 0 = inactive, 1 = active
  createdAt: Date
  updatedAt: Date
}

const categoryLogoSchema = new Schema<ICategoryLogo>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    status: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

categoryLogoSchema.index({ status: 1 })
categoryLogoSchema.index({ status: 1, name: 1 })
categoryLogoSchema.index({ createdAt: -1 })
categoryLogoSchema.index({ name: 1 })

export const CategoryLogo = registerModel<ICategoryLogo>(
  "CategoryLogo",
  categoryLogoSchema
)

// ============================================================
// Logo — Sản phẩm logo (template / catalog)
// SQL: logos (id, stt, title, slug, image, category_id, content,
//             price, download, status, created_at)
// ============================================================
export interface ILogo extends Document {
  stt: number // sort order — admin set
  title: string
  slug: string
  image: string | null // ảnh preview
  categoryId: mongoose.Types.ObjectId
  content: string | null // HTML content (rich text)
  price: number // VND
  status: number // 0 = inactive, 1 = active
  // Aggregate counters
  salesCount: number
  view: number
  createdAt: Date
  updatedAt: Date
}

const logoSchema = new Schema<ILogo>(
  {
    stt: { type: Number, default: 0 },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    image: { type: String, default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: "CategoryLogo", required: true },
    content: { type: String, default: null },
    price: { type: Number, required: true, min: 0 },
    status: { type: Number, default: 1 },
    salesCount: { type: Number, default: 0, min: 0 },
    view: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

// Detail active logo by slug
logoSchema.index({ slug: 1, status: 1 })
// ESR — list active logos with sort by stt then createdAt
logoSchema.index({ status: 1, stt: 1, createdAt: -1 })
// Filter by category
logoSchema.index({ status: 1, categoryId: 1, stt: 1, createdAt: -1 })
// Price range filter + sort
logoSchema.index({ status: 1, price: 1 })
logoSchema.index({ status: 1, categoryId: 1, price: 1 })
// Trending — by salesCount
logoSchema.index({ status: 1, salesCount: -1 })
logoSchema.index({ status: 1, categoryId: 1, salesCount: -1 })
// Full-text search
logoSchema.index(
  { title: "text", content: "text" },
  { weights: { title: 10, content: 1 }, name: "logo_text_index" }
)

export const Logo = registerModel<ILogo>("Logo", logoSchema)

// ============================================================
// LogoOrder — Đơn thuê logo của user
// Tách bảng riêng để có audit trail + lịch sử download an toàn.
// ============================================================
//
// Status chuẩn cho đơn thủ công admin xử lý:
//  - pending          : Đang xử lý (khởi tạo)
//  - completed        : Hoạt động (đã bàn giao)
//  - cancelled        : Đã hủy
//  - cancelled_refund : Đã hủy (Hoàn tiền)
//  - error_refund     : Lỗi (Hoàn tiền)
//  - suspended        : Tạm khóa
// (Logo không có "expired" vì mua lủt là chạy viễn)
export const LOGO_ORDER_STATUSES = [
  "pending",
  "completed",
  "cancelled",
  "cancelled_refund",
  "error_refund",
  "suspended",
] as const
export type LogoOrderStatus = (typeof LOGO_ORDER_STATUSES)[number]

export interface ILogoOrder extends Document {
  userId: mongoose.Types.ObjectId
  logoId: mongoose.Types.ObjectId
  // Snapshot tại thời điểm mua — giữ nguyên kể cả admin đổi
  logoTitle: string
  logoSlug: string
  logoImage: string | null
  /** Tên shop / website user nhập để designer custom vào logo */
  shopName: string
  /** Ghi chú thêm (color, line 2/3...) optional */
  customNote: string | null
  price: number // VND tại thời điểm thuê
  status: LogoOrderStatus
  /**
   * Link file thiết kế admin/designer giao cho khách sau khi hoàn thành.
   * NULL khi pending. User chỉ thấy khi status = completed.
   */
  deliveryUrl: string | null
  /** Note designer/admin nội bộ gửi cho khách khi giao file */
  deliveryNote: string | null
  // Số lần user đã download (anti-abuse)
  downloadCount: number
  lastDownloadAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const logoOrderSchema = new Schema<ILogoOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    logoId: { type: Schema.Types.ObjectId, ref: "Logo", required: true, index: true },
    logoTitle: { type: String, required: true },
    logoSlug: { type: String, required: true },
    logoImage: { type: String, default: null },
    shopName: { type: String, required: true, trim: true, maxlength: 200 },
    customNote: { type: String, default: null, maxlength: 1000 },
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: LOGO_ORDER_STATUSES, default: "pending" },
    deliveryUrl: { type: String, default: null, maxlength: 2000 },
    deliveryNote: { type: String, default: null, maxlength: 1000 },
    downloadCount: { type: Number, default: 0, min: 0 },
    lastDownloadAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

// ESR — list user's orders sorted by recency
logoOrderSchema.index({ userId: 1, createdAt: -1 })
logoOrderSchema.index({ userId: 1, status: 1, createdAt: -1 })
logoOrderSchema.index({ userId: 1, price: -1 })
logoOrderSchema.index({ userId: 1, logoTitle: 1 })
logoOrderSchema.index({ userId: 1, logoId: 1, status: 1 })
// User có thể thuê cùng 1 logo nhiều lần (mỗi lần shopName khác nhau)
// → KHÔNG có unique index (userId, logoId)
// Admin: filter theo logo
logoOrderSchema.index({ logoId: 1, createdAt: -1 })

export const LogoOrder = registerModel<ILogoOrder>("LogoOrder", logoOrderSchema)
