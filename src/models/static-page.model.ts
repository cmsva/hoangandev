import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// StaticPage — Trang tĩnh do admin tạo (slug động /[slug])
// ============================================================
export interface IStaticPage extends Document {
  _id: mongoose.Types.ObjectId
  slug: string
  title: string
  description: string | null
  keywords: string[]
  content: string // HTML (CKEditor)
  requireLogin: boolean
  status: number // 1 = hiển thị, 0 = ẩn
  view: number
  createdAt: Date
  updatedAt: Date
}

const staticPageSchema = new Schema<IStaticPage>(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    keywords: { type: [String], default: [] },
    content: { type: String, default: "" },
    requireLogin: { type: Boolean, default: false },
    status: { type: Number, default: 1 },
    view: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
)

staticPageSchema.index({ status: 1, createdAt: -1 })
staticPageSchema.index({ title: "text" }, { name: "static_page_text" })

export const StaticPage = registerModel<IStaticPage>("StaticPage", staticPageSchema)
