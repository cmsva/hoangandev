import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { Post, PostCategory } from "@/models/post.model"
import { escapeRegex } from "@/lib/sanitize"

// No DB cache — luôn fresh. Các invalidate function giữ chữ ký no-op cho caller cũ.
function clearAdminPostCaches(): void {
  // No-op.
}

function clearAdminPostCategoryCaches(): void {
  // No-op.
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  return new Types.ObjectId(id)
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)
}

async function ensureUniquePostSlug(slug: string, excludeId?: string): Promise<string> {
  const baseSlug = slug || `bai-viet-${Date.now().toString(36)}`
  const filter: Record<string, unknown> = { slug: baseSlug }
  if (excludeId) filter._id = { $ne: toObjectId(excludeId) }
  const exists = await Post.findOne(filter).select("_id").lean()
  return exists ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug
}

async function ensureUniquePostCategorySlug(slug: string, excludeId?: string): Promise<string> {
  const baseSlug = slug || `chuyen-muc-${Date.now().toString(36)}`
  const filter: Record<string, unknown> = { slug: baseSlug }
  if (excludeId) filter._id = { $ne: toObjectId(excludeId) }
  const exists = await PostCategory.findOne(filter).select("_id").lean()
  return exists ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug
}

export interface AdminPostCategoryListInput {
  page: number
  limit: number
  keyword?: string
}

export async function listAdminPostCategories(input: AdminPostCategoryListInput) {
  const skip = (input.page - 1) * input.limit
  const filter: Record<string, unknown> = {}
  if (input.keyword) filter.name = { $regex: escapeRegex(input.keyword), $options: "i" }

  const [result] = await PostCategory.aggregate([
    { $match: filter },
    {
      $facet: {
        items: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: input.limit },
          {
            $lookup: {
              from: "posts",
              localField: "_id",
              foreignField: "categoryId",
              as: "_posts",
              pipeline: [{ $count: "n" }],
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              status: 1,
              createdAt: 1,
              postCount: { $ifNull: [{ $arrayElemAt: ["$_posts.n", 0] }, 0] },
            },
          },
        ],
        meta: [{ $count: "total" }],
      },
    },
  ])

  const items = (result?.items ?? []) as Array<Record<string, any>>
  const total = Number(result?.meta?.[0]?.total ?? 0)
  return {
    items: items.map((category) => ({
      id: String(category._id),
      name: String(category.name),
      slug: String(category.slug),
      status: Number(category.status),
      postCount: Number(category.postCount ?? 0),
      createdAt: category.createdAt,
    })),
    total,
    page: input.page,
    limit: input.limit,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  }
}
export interface PostCategoryUpsertInput {
  name: string
  slug?: string
  status?: number
}

export async function createPostCategory(input: PostCategoryUpsertInput) {
  const slug = await ensureUniquePostCategorySlug(slugify(input.slug || input.name))
  const doc = await PostCategory.create({
    name: input.name.trim(),
    slug,
    status: input.status ?? 1,
  })
  clearAdminPostCategoryCaches()
  return { id: String(doc._id) }
}

export async function updatePostCategory(id: string, input: PostCategoryUpsertInput) {
  const update: Record<string, unknown> = {
    name: input.name.trim(),
    status: input.status ?? 1,
  }
  if (input.slug) update.slug = await ensureUniquePostCategorySlug(slugify(input.slug), id)
  await PostCategory.updateOne({ _id: toObjectId(id) }, { $set: update })
  clearAdminPostCategoryCaches()
}

export async function deletePostCategory(id: string) {
  const _id = toObjectId(id)
  const used = await Post.countDocuments({ categoryId: _id })
  if (used > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Danh mục đang có ${used} bài viết` })
  }
  await PostCategory.deleteOne({ _id })
  clearAdminPostCategoryCaches()
}

export async function listPostCategoriesForSelect() {
  const items = await PostCategory.find({})
    .select("_id name")
    .sort({ name: 1 })
    .lean()
  return items.map((category) => ({ id: String(category._id), name: category.name }))
}

export interface AdminPostListInput {
  page: number
  limit: number
  keyword?: string
  categoryId?: string
  status?: number
}

export async function listAdminPosts(input: AdminPostListInput) {
  const skip = (input.page - 1) * input.limit
  const filter: Record<string, unknown> = {}
  if (typeof input.status === "number") filter.status = input.status
  if (input.categoryId) filter.categoryId = toObjectId(input.categoryId)
  if (input.keyword) filter.title = { $regex: escapeRegex(input.keyword), $options: "i" }

  const [items, total] = await Promise.all([
    Post.find(filter)
      .select("title slug excerpt thumbnail categoryId status featured view createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(input.limit)
      .populate("categoryId", "name")
      .lean(),
    Post.countDocuments(filter),
  ])

  return {
    items: items.map((post: any) => ({
      id: String(post._id),
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      thumbnail: post.thumbnail,
      status: post.status,
      featured: post.featured,
      view: post.view,
      category: post.categoryId ? { id: String(post.categoryId._id), name: post.categoryId.name } : null,
      createdAt: post.createdAt,
    })),
    total,
    page: input.page,
    limit: input.limit,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  }
}
export interface PostUpsertInput {
  title: string
  slug?: string
  excerpt?: string | null
  content: string
  thumbnail?: string | null
  categoryId: string
  status?: number
  featured?: boolean
  metaTitle?: string | null
  metaDescription?: string | null
  metaKeywords?: string[]
}

export async function createPost(input: PostUpsertInput) {
  const slug = await ensureUniquePostSlug(slugify(input.slug || input.title))
  const doc = await Post.create({
    title: input.title.trim(),
    slug,
    excerpt: input.excerpt ?? null,
    content: input.content,
    thumbnail: input.thumbnail ?? null,
    categoryId: toObjectId(input.categoryId),
    status: input.status ?? 1,
    featured: input.featured ?? false,
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    metaKeywords: input.metaKeywords ?? [],
  })
  clearAdminPostCaches()
  return { id: String(doc._id) }
}

export async function getAdminPost(id: string) {
  const post = (await Post.findById(toObjectId(id)).lean()) as any
  if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy bài viết" })
  return {
    id: String(post._id),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    content: post.content ?? "",
    thumbnail: post.thumbnail,
    categoryId: String(post.categoryId),
    status: post.status,
    featured: post.featured,
    metaTitle: post.metaTitle ?? "",
    metaDescription: post.metaDescription ?? "",
    metaKeywords: post.metaKeywords ?? [],
  }
}

export async function updatePost(id: string, input: PostUpsertInput) {
  const update: Record<string, unknown> = {
    title: input.title.trim(),
    excerpt: input.excerpt ?? null,
    content: input.content,
    thumbnail: input.thumbnail ?? null,
    categoryId: toObjectId(input.categoryId),
    status: input.status ?? 1,
    featured: input.featured ?? false,
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    metaKeywords: input.metaKeywords ?? [],
  }
  if (input.slug) update.slug = await ensureUniquePostSlug(slugify(input.slug), id)
  await Post.updateOne({ _id: toObjectId(id) }, { $set: update })
  clearAdminPostCaches()
}

export async function deletePost(id: string) {
  await Post.deleteOne({ _id: toObjectId(id) })
  clearAdminPostCaches()
}

// ─── Bulk Delete ───
export async function bulkDeletePostCategories(ids: string[]) {
  const result = await PostCategory.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeletePosts(ids: string[]) {
  const result = await Post.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}
