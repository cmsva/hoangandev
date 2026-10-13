import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Category — Danh mục sản phẩm
// ============================================================
export interface ICategory extends Document {
  name: string
  slug: string
  parentCategoryId: mongoose.Types.ObjectId | null
  status: number // 0 = inactive, 1 = active
  thumbnail: string | null
  createdAt: Date
  updatedAt: Date
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    parentCategoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    status: { type: Number, default: 1 },
    thumbnail: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

categorySchema.index({ status: 1 })
categorySchema.index({ parentCategoryId: 1 })
categorySchema.index({ createdAt: -1 })
categorySchema.index({ name: 1 })

export const Category = registerModel<ICategory>("Category", categorySchema)

// ============================================================
// Product — Mã nguồn / Source code
// ============================================================
export interface IProduct extends Document {
  title: string
  slug: string
  description: string | null // Mỗi dòng = 1 feature tick (e.g. "Hỗ trợ setup hoàn chỉnh")
  detail: string | null // HTML content chi tiết
  price: number
  salePrice: number | null
  discountPercentage: number | null
  categoryId: mongoose.Types.ObjectId
  sellerId: mongoose.Types.ObjectId | null
  thumbnail: string | null
  images: string[] // Gallery screenshots
  fileUrl: string
  status: number // 0 = inactive, 1 = active
  isFree: boolean
  salesCount: number
  view: number
  approved: boolean
  tags: string[] // e.g. ["React", "PHP", "JavaScript"]
  createdAt: Date
  updatedAt: Date
}

const productSchema = new Schema<IProduct>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: null },
    detail: { type: String, default: null },
    price: { type: Number, required: true },
    salePrice: { type: Number, default: null },
    discountPercentage: { type: Number, default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    thumbnail: { type: String, default: null },
    images: { type: [String], default: [] },
    fileUrl: { type: String, required: true },
    status: { type: Number, default: 1 },
    isFree: { type: Boolean, default: false },
    salesCount: { type: Number, default: 0 },
    view: { type: Number, default: 0 },
    approved: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

// Detail lookup by slug + active status
productSchema.index({ slug: 1, status: 1 })
// ESR cho list query: status+approved (Equality) → salesCount/createdAt (Sort/Range)
productSchema.index({ status: 1, approved: 1, salesCount: -1, createdAt: -1 })
// ESR cho list theo category
productSchema.index({ status: 1, approved: 1, categoryId: 1, salesCount: -1 })
// Range query giá
productSchema.index({ status: 1, approved: 1, price: 1 })
// Admin list/filter
productSchema.index({ categoryId: 1, createdAt: -1 })
productSchema.index({ status: 1, createdAt: -1 })
// Full-text search với weight ưu tiên title
productSchema.index(
  { title: "text", description: "text", tags: "text" },
  { weights: { title: 10, tags: 5, description: 1 }, name: "product_text_index" }
)

export const Product = registerModel<IProduct>("Product", productSchema)
