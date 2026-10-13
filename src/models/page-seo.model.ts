import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// PageSeo — SEO override cho các page code cứng (theo key)
// ============================================================
export interface IPageSeo extends Document {
  _id: mongoose.Types.ObjectId
  key: string // vd "source-code", "home", "contact"
  title: string | null
  description: string | null
  keywords: string[]
  ogImage: string | null
  createdAt: Date
  updatedAt: Date
}

const pageSeoSchema = new Schema<IPageSeo>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    title: { type: String, default: null },
    description: { type: String, default: null },
    keywords: { type: [String], default: [] },
    ogImage: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
)

export const PageSeo = registerModel<IPageSeo>("PageSeo", pageSeoSchema)
