/**
 * Product controller — business logic cho catalog mã nguồn (browse).
 *
 * NOTE: Order ops (mua mã nguồn) ở `order.controller.ts` (DRY: 1 module 1 file).
 */
import { Types } from "mongoose"
import { Product, Category, type IProduct, type ICategory } from "@/models/product.model"
import { logger } from "@/lib/logger"
import { escapeRegex } from "@/lib/sanitize"

// ─── In-memory throttle cho view counter (correctness, không phải cache) ───
const viewThrottleMap = new Map<string, number>()
const VIEW_THROTTLE_MS = 30 * 60_000

// No detail cache — luôn fresh từ DB.
const productDetailInflight = new Map<string, Promise<any>>()

export function shouldCountProductView(key: string): boolean {
  const now = Date.now()
  const last = viewThrottleMap.get(key)
  if (last && now - last < VIEW_THROTTLE_MS) return false
  viewThrottleMap.set(key, now)
  if (viewThrottleMap.size > 5_000) {
    const cutoff = now - VIEW_THROTTLE_MS
    for (const [k, t] of viewThrottleMap) {
      if (t < cutoff) viewThrottleMap.delete(k)
    }
  }
  return true
}

// ─── Repository ─────────────────────────────────────────────────────────────

export async function listActiveProductCategories() {
  return (await Category.find({ status: 1 })
    .select("name slug thumbnail")
    .sort({ name: 1 })
    .lean()) as unknown as Array<Pick<ICategory, "_id" | "name" | "slug"> & { thumbnail?: string }>
}

async function fetchProductBySlug(slug: string) {
  // 1 round trip: $lookup thay cho findOne + populate (2 round trips).
  // Reshape category về lại field `categoryId` để serializer giữ nguyên.
  const docs = await Product.aggregate([
    { $match: { slug, status: 1, approved: true } },
    { $limit: 1 },
    {
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "categoryId",
        pipeline: [{ $project: { name: 1, slug: 1 } }],
      },
    },
    { $unwind: { path: "$categoryId", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        title: 1,
        slug: 1,
        description: 1,
        detail: 1,
        price: 1,
        salePrice: 1,
        discountPercentage: 1,
        thumbnail: 1,
        images: 1,
        isFree: 1,
        salesCount: 1,
        view: 1,
        tags: 1,
        categoryId: 1,
        createdAt: 1,
      },
    },
  ])
  return docs[0] ?? null
}

export async function findProductBySlug(slug: string) {
  const key = slug.trim().toLowerCase()

  // De-dupe inflight requests với cùng key (tránh thundering herd cùng 1 tick).
  const inflight = productDetailInflight.get(key)
  if (inflight) return inflight

  const pending = fetchProductBySlug(key)
    .finally(() => productDetailInflight.delete(key))

  productDetailInflight.set(key, pending)
  return pending
}

export function serializeProductDetail(product: any) {
  if (!product) return null
  return {
    id: product._id.toString(),
    title: product.title,
    slug: product.slug,
    description: product.description,
    detail: product.detail,
    price: product.price,
    salePrice: product.salePrice,
    discountPercentage: product.discountPercentage,
    thumbnail: product.thumbnail,
    images: product.images || [],
    isFree: product.isFree,
    salesCount: product.salesCount,
    view: product.view,
    tags: product.tags ?? [],
    category: product.categoryId
      ? { name: product.categoryId.name, slug: product.categoryId.slug }
      : null,
    categoryId: product.categoryId?._id?.toString(),
    createdAt: product.createdAt,
  }
}

export function serializeProductMeta(product: any) {
  if (!product) return null
  const detail = serializeProductDetail(product)
  if (!detail) return null
  return {
    title: detail.title,
    description: detail.description,
    thumbnail: detail.thumbnail,
  }
}

export async function findRelatedProducts(slug: string, categoryId?: string) {
  const filter: Record<string, any> = {
    status: 1,
    approved: true,
    slug: { $ne: slug },
  }
  if (categoryId) {
    // Cast string → ObjectId (find() cũng auto-cast nhưng explicit cho an toàn)
    filter.categoryId = Types.ObjectId.isValid(categoryId)
      ? new Types.ObjectId(categoryId)
      : categoryId
  }

  return (await Product.find(filter)
    .select("title slug price salePrice discountPercentage thumbnail isFree salesCount tags categoryId")
    .sort({ salesCount: -1 })
    .limit(4)
    .populate("categoryId", "name slug")
    .lean()) as any[]
}

// ─── Search filter (pure) ───────────────────────────────────────────────────

export function buildProductListFilter(input: {
  search?: string
  categoryId?: string
}): Record<string, any> {
  const filter: Record<string, any> = { status: 1, approved: true }
  // CRITICAL: aggregate $match KHÔNG tự cast string → ObjectId (khác find()).
  // Nếu không cast, filter.categoryId = "abc" sẽ không match được document
  // có categoryId là ObjectId("abc") → trả 0 kết quả dù có dữ liệu.
  if (input.categoryId) {
    filter.categoryId = Types.ObjectId.isValid(input.categoryId)
      ? new Types.ObjectId(input.categoryId)
      : input.categoryId
  }

  if (input.search) {
    if (input.search.length >= 3) {
      filter.$text = { $search: input.search }
    } else {
      filter.title = { $regex: escapeRegex(input.search), $options: "i" }
    }
  }
  return filter
}

// ─── List aggregation ───────────────────────────────────────────────────────

export interface ListProductsInput {
  page: number
  limit: number
  search?: string
  categoryId?: string
}

export async function listProducts(input: ListProductsInput) {
  const { page, limit } = input
  const skip = (page - 1) * limit
  const filter = buildProductListFilter(input)

  const pipeline: any[] = [
    { $match: filter },
    { $sort: { salesCount: -1, createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "categories",
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
        description: 1,
        price: 1,
        salePrice: 1,
        discountPercentage: 1,
        thumbnail: 1,
        isFree: 1,
        salesCount: 1,
        tags: 1,
        "category.name": 1,
        "category.slug": 1,
      },
    },
  ]

  const [products, total] = await Promise.all([
    Product.aggregate(pipeline).exec(),
    Product.countDocuments(filter),
  ])

  return {
    items: products.map((p: any, index: number) => ({
      id: p._id.toString(),
      title: p.title,
      slug: p.slug,
      description: p.description,
      price: p.price,
      salePrice: p.salePrice,
      discountPercentage: p.discountPercentage,
      thumbnail: p.thumbnail,
      isFree: p.isFree,
      salesCount: p.salesCount,
      tags: p.tags ?? [],
      category: p.category
        ? { name: p.category.name, slug: p.category.slug }
        : null,
      rank: skip + index + 1,
    })),
    total,
  }
}

// ─── Side-effects ───────────────────────────────────────────────────────────

export function incProductView(productId: Types.ObjectId | string) {
  Product.updateOne({ _id: productId }, { $inc: { view: 1 } })
    .exec()
    .catch((err) =>
      logger.warn("product view inc failed", {
        module: "product.incProductView",
        error: (err as Error).message,
      })
    )
}
