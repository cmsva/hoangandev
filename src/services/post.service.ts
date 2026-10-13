import { Types } from "mongoose"
import { Post, PostCategory } from "@/models/post.model"
import { escapeRegex } from "@/lib/sanitize"

const viewThrottleMap = new Map<string, number>()
const VIEW_THROTTLE_MS = 30 * 60_000

// No data cache — luôn fresh từ DB. Chỉ giữ inflight de-dupe để chống thundering herd.
const postDetailInflight = new Map<string, Promise<any>>()
const postListInflight = new Map<string, Promise<{ items: any[]; total: number }>>()
let postCategoriesInflight: Promise<any[]> | null = null


export function shouldCountPostView(key: string): boolean {
  const now = Date.now()
  const last = viewThrottleMap.get(key)
  if (last && now - last < VIEW_THROTTLE_MS) return false
  viewThrottleMap.set(key, now)
  if (viewThrottleMap.size > 5_000) {
    const cutoff = now - VIEW_THROTTLE_MS
    for (const [mapKey, time] of viewThrottleMap) {
      if (time < cutoff) viewThrottleMap.delete(mapKey)
    }
  }
  return true
}

export async function listActivePostCategories() {
  if (postCategoriesInflight) return postCategoriesInflight

  postCategoriesInflight = PostCategory.find({ status: 1 })
    .select("_id name slug")
    .sort({ name: 1 })
    .lean()
    .finally(() => {
      postCategoriesInflight = null
    })
  return postCategoriesInflight
}

async function fetchPostBySlug(slug: string) {
  return await Post.findOne({ slug, status: 1 })
    .select("title slug excerpt content thumbnail categoryId featured view metaTitle metaDescription metaKeywords createdAt")
    .populate("categoryId", "name slug")
    .lean()
}

export async function findPostBySlug(slug: string) {
  const key = slug.trim().toLowerCase()
  const inflight = postDetailInflight.get(key)
  if (inflight) return inflight

  const pending = fetchPostBySlug(key)
    .finally(() => postDetailInflight.delete(key))

  postDetailInflight.set(key, pending)
  return pending
}

export function serializePostDetail(post: any) {
  if (!post) return null
  return {
    id: String(post._id),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    thumbnail: post.thumbnail,
    featured: post.featured,
    view: post.view,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    metaKeywords: post.metaKeywords ?? [],
    category: post.categoryId ? { name: post.categoryId.name, slug: post.categoryId.slug } : null,
    categoryId: post.categoryId?._id?.toString(),
    createdAt: post.createdAt,
  }
}
export function serializePostMeta(post: any) {
  if (!post) return null
  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    thumbnail: post.thumbnail,
    keywords: post.metaKeywords ?? [],
  }
}

export interface ListPostsInput {
  page: number
  limit: number
  search?: string
  categoryId?: string
}

export async function listPosts(input: ListPostsInput) {
  const cacheKey = JSON.stringify(input)
  const inflight = postListInflight.get(cacheKey)
  if (inflight) return inflight

  const skip = (input.page - 1) * input.limit
  const filter: Record<string, unknown> = { status: 1 }
  if (input.categoryId) filter.categoryId = Types.ObjectId.isValid(input.categoryId) ? new Types.ObjectId(input.categoryId) : input.categoryId
  if (input.search) {
    if (input.search.length >= 3) filter.$text = { $search: input.search }
    else filter.title = { $regex: escapeRegex(input.search), $options: "i" }
  }

  const pipeline: any[] = [
    { $match: filter },
    { $sort: { featured: -1, createdAt: -1 } },
    { $skip: skip },
    { $limit: input.limit },
    {
      $lookup: {
        from: "postcategories",
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
        pipeline: [{ $project: { name: 1, slug: 1 } }],
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        title: 1,
        slug: 1,
        excerpt: 1,
        thumbnail: 1,
        featured: 1,
        view: 1,
        createdAt: 1,
        "category.name": 1,
        "category.slug": 1,
      },
    },
  ]

  const pending = Promise.all([
    Post.aggregate(pipeline).exec(),
    Post.countDocuments(filter),
  ])
    .then(([posts, total]) => {
      return {
        items: posts.map((post: any) => ({
          id: String(post._id),
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          thumbnail: post.thumbnail,
          featured: post.featured,
          view: post.view,
          createdAt: post.createdAt,
          category: post.category ? { name: post.category.name, slug: post.category.slug } : null,
        })),
        total,
      }
    })
    .finally(() => postListInflight.delete(cacheKey))

  postListInflight.set(cacheKey, pending)
  return pending
}

export async function findRelatedPosts(slug: string, categoryId?: string) {
  const filter: Record<string, unknown> = { status: 1, slug: { $ne: slug } }
  if (categoryId) filter.categoryId = Types.ObjectId.isValid(categoryId) ? new Types.ObjectId(categoryId) : categoryId
  return await Post.find(filter)
    .select("title slug excerpt thumbnail categoryId createdAt")
    .sort({ featured: -1, createdAt: -1 })
    .limit(4)
    .populate("categoryId", "name slug")
    .lean()
}

export function incPostView(id: Types.ObjectId) {
  Post.updateOne({ _id: id }, { $inc: { view: 1 } }).catch(() => {})
}
