import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

export interface IPostCategory extends Document {
  name: string
  slug: string
  status: number
  createdAt: Date
  updatedAt: Date
}

const postCategorySchema = new Schema<IPostCategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    status: { type: Number, default: 1 },
  },
  { timestamps: true, versionKey: false }
)

postCategorySchema.index({ status: 1, name: 1 })
postCategorySchema.index({ createdAt: -1 })

export interface IPost extends Document {
  title: string
  slug: string
  excerpt: string | null
  content: string
  thumbnail: string | null
  categoryId: mongoose.Types.ObjectId
  status: number
  featured: boolean
  view: number
  metaTitle: string | null
  metaDescription: string | null
  metaKeywords: string[]
  createdAt: Date
  updatedAt: Date
}

const postSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    excerpt: { type: String, default: null },
    content: { type: String, required: true },
    thumbnail: { type: String, default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: "PostCategory", required: true },
    status: { type: Number, default: 1 },
    featured: { type: Boolean, default: false },
    view: { type: Number, default: 0 },
    metaTitle: { type: String, default: null },
    metaDescription: { type: String, default: null },
    metaKeywords: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false }
)

postSchema.index({ slug: 1, status: 1 })
postSchema.index({ status: 1, featured: -1, createdAt: -1 })
postSchema.index({ status: 1, categoryId: 1, createdAt: -1 })
postSchema.index({ status: 1, createdAt: -1 })
postSchema.index({ categoryId: 1, createdAt: -1 })
postSchema.index({ title: "text", excerpt: "text", metaKeywords: "text" }, { weights: { title: 10, metaKeywords: 5, excerpt: 2 }, name: "post_text_index" })

export const PostCategory = registerModel<IPostCategory>("PostCategory", postCategorySchema)
export const Post = registerModel<IPost>("Post", postSchema)
