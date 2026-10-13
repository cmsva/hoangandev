import mongoose, { Schema, Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

/**
 * Category cho Service templates (vd: "Web Shop Acc", "Web SMM/MMO", "Web Forum").
 * Dùng để filter ở /create-website tabs.
 */
export interface ICategoryService extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  slug: string
  status: number // 1 active / 0 inactive
  createdAt: Date
  updatedAt: Date
}

const categoryServiceSchema = new Schema<ICategoryService>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    status: { type: Number, default: 1 },
  },
  { timestamps: true, versionKey: false, collection: "categoryservices" }
)

categoryServiceSchema.index({ status: 1, name: 1 })

export const CategoryService = registerModel<ICategoryService>(
  "CategoryService",
  categoryServiceSchema
)
