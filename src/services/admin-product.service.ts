/**
 * Admin product service — CRUD cho mã nguồn (Product) + Category.
 *
 * Pure logic, không phụ thuộc tRPC ctx. Thrown TRPCError cho lỗi nghiệp vụ.
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { Product, Category, type IProduct, type ICategory } from "@/models/product.model"
import { Order } from "@/models/order-product.model"
import { escapeRegex } from "@/lib/sanitize"

// ─── Helpers ────────────────────────────────────────────────────────────────

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

async function ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
  const filter: any = { slug }
  if (excludeId) filter._id = { $ne: toObjectId(excludeId) }
  const exists = await Product.findOne(filter).select("_id").lean()
  return exists ? `${slug}-${Date.now().toString(36)}` : slug
}

async function ensureUniqueCategorySlug(slug: string, excludeId?: string): Promise<string> {
  const filter: any = { slug }
  if (excludeId) filter._id = { $ne: toObjectId(excludeId) }
  const exists = await Category.findOne(filter).select("_id").lean()
  return exists ? `${slug}-${Date.now().toString(36)}` : slug
}

// ═══ CATEGORIES ═════════════════════════════════════════════════════════════

export interface CategoryListInput {
  page: number
  limit: number
  keyword?: string
}

export async function listAdminCategories(input: CategoryListInput) {
  const { page, limit, keyword } = input
  const skip = (page - 1) * limit

  const filter: Record<string, any> = {}
  if (keyword) {
    filter.name = { $regex: escapeRegex(keyword), $options: "i" }
  }

  // ─── Single roundtrip: data + total + product counts qua $facet ───
  const [result] = await Category.aggregate([
    { $match: filter },
    {
      $facet: {
        items: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "categoryId",
              as: "_products",
              pipeline: [{ $count: "n" }],
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              thumbnail: 1,
              status: 1,
              createdAt: 1,
              productCount: {
                $ifNull: [{ $arrayElemAt: ["$_products.n", 0] }, 0],
              },
            },
          },
        ],
        meta: [{ $count: "total" }],
      },
    },
  ])

  const items = (result?.items ?? []) as any[]
  const total: number = result?.meta?.[0]?.total ?? 0

  return {
    items: items.map((c: any) => ({
      id: String(c._id),
      name: c.name,
      slug: c.slug,
      thumbnail: c.thumbnail,
      status: c.status,
      productCount: c.productCount ?? 0,
      createdAt: c.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export interface CategoryUpsertInput {
  name: string
  slug?: string
  thumbnail?: string | null
  status?: number
}

export async function createCategory(input: CategoryUpsertInput) {
  const slug = await ensureUniqueCategorySlug(slugify(input.slug || input.name))
  const doc = await Category.create({
    name: input.name.trim(),
    slug,
    thumbnail: input.thumbnail ?? null,
    status: input.status ?? 1,
  })
  return { id: String(doc._id) }
}

export async function getCategory(id: string) {
  const c = (await Category.findById(toObjectId(id)).lean()) as any
  if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy danh mục" })
  return {
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    thumbnail: c.thumbnail,
    status: c.status,
  }
}

export async function updateCategory(id: string, input: CategoryUpsertInput) {
  const _id = toObjectId(id)
  const update: Record<string, any> = {
    name: input.name.trim(),
    thumbnail: input.thumbnail ?? null,
  }
  if (typeof input.status === "number") update.status = input.status
  if (input.slug) {
    update.slug = await ensureUniqueCategorySlug(slugify(input.slug), id)
  }
  await Category.updateOne({ _id }, { $set: update })
}

export async function deleteCategory(id: string) {
  const _id = toObjectId(id)
  const used = await Product.countDocuments({ categoryId: _id })
  if (used > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Không thể xóa: đang có ${used} mã nguồn thuộc danh mục này. Vui lòng chuyển mã nguồn sang danh mục khác hoặc ẩn thay vì xóa.`,
    })
  }
  await Category.deleteOne({ _id })
}

// ═══ PRODUCTS ═══════════════════════════════════════════════════════════════

export interface AdminProductListInput {
  page: number
  limit: number
  keyword?: string
  categoryId?: string
  status?: number
}

export async function listAdminProducts(input: AdminProductListInput) {
  const { page, limit, keyword, categoryId, status } = input
  const skip = (page - 1) * limit

  const filter: Record<string, any> = {}
  if (typeof status === "number") filter.status = status
  if (categoryId) {
    filter.categoryId = Types.ObjectId.isValid(categoryId)
      ? new Types.ObjectId(categoryId)
      : categoryId
  }
  if (keyword) {
    filter.title = { $regex: escapeRegex(keyword), $options: "i" }
  }

  // Use lean + projection to minimize bandwidth
  // Avoid `populate` which makes a 2nd roundtrip; use $lookup in aggregate or accept N+1 for small page sizes
  const [items, total] = await Promise.all([
    Product.find(filter)
      .select("title slug price salePrice thumbnail status isFree approved salesCount view categoryId createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("categoryId", "name")
      .lean(),
    Product.countDocuments(filter),
  ])

  return {
    items: items.map((p: any) => ({
      id: String(p._id),
      title: p.title,
      slug: p.slug,
      price: p.price,
      salePrice: p.salePrice,
      thumbnail: p.thumbnail,
      status: p.status,
      isFree: p.isFree,
      approved: p.approved,
      salesCount: p.salesCount,
      view: p.view,
      category: p.categoryId
        ? { id: String(p.categoryId._id), name: p.categoryId.name }
        : null,
      createdAt: p.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function listAllCategoriesForSelect() {
  const items = await Category.find({}).select("_id name").sort({ name: 1 }).lean()
  return items.map((c: any) => ({ id: String(c._id), name: c.name }))
}

export interface ProductUpsertInput {
  title: string
  slug?: string
  description?: string | null
  detail?: string | null
  price: number
  salePrice?: number | null
  discountPercentage?: number | null
  categoryId: string
  thumbnail?: string | null
  images?: string[]
  fileUrl: string
  status?: number
  isFree?: boolean
  approved?: boolean
  tags?: string[]
}

export async function createProduct(input: ProductUpsertInput) {
  const slug = await ensureUniqueSlug(slugify(input.slug || input.title))
  const doc = await Product.create({
    title: input.title.trim(),
    slug,
    description: input.description ?? null,
    detail: input.detail ?? null,
    price: Math.max(0, Number(input.price) || 0),
    salePrice: input.salePrice ?? null,
    discountPercentage: input.discountPercentage ?? null,
    categoryId: toObjectId(input.categoryId),
    thumbnail: input.thumbnail ?? null,
    images: input.images ?? [],
    fileUrl: input.fileUrl.trim(),
    status: input.status ?? 1,
    isFree: !!input.isFree,
    approved: input.approved ?? true,
    tags: input.tags ?? [],
  })
  return { id: String(doc._id) }
}

export async function getAdminProduct(id: string) {
  const p = (await Product.findById(toObjectId(id)).lean()) as any
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy sản phẩm" })
  return {
    id: String(p._id),
    title: p.title,
    slug: p.slug,
    description: p.description ?? "",
    detail: p.detail ?? "",
    price: p.price,
    salePrice: p.salePrice,
    discountPercentage: p.discountPercentage,
    categoryId: String(p.categoryId),
    thumbnail: p.thumbnail,
    images: p.images ?? [],
    fileUrl: p.fileUrl,
    status: p.status,
    isFree: p.isFree,
    approved: p.approved,
    tags: p.tags ?? [],
  }
}

export async function updateProduct(id: string, input: ProductUpsertInput) {
  const _id = toObjectId(id)
  const update: Record<string, any> = {
    title: input.title.trim(),
    description: input.description ?? null,
    detail: input.detail ?? null,
    price: Math.max(0, Number(input.price) || 0),
    salePrice: input.salePrice ?? null,
    discountPercentage: input.discountPercentage ?? null,
    categoryId: toObjectId(input.categoryId),
    thumbnail: input.thumbnail ?? null,
    images: input.images ?? [],
    fileUrl: input.fileUrl.trim(),
    status: input.status ?? 1,
    isFree: !!input.isFree,
    approved: input.approved ?? true,
    tags: input.tags ?? [],
  }
  if (input.slug) {
    update.slug = await ensureUniqueSlug(slugify(input.slug), id)
  }
  await Product.updateOne({ _id }, { $set: update })
}

export async function deleteProduct(id: string) {
  const _id = toObjectId(id)

  // ─── Guard 1: Đã có đơn mua → chặn hoàn toàn
  const sold = await Order.countDocuments({ productId: _id })
  if (sold > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Không thể xóa mã nguồn này vì đã có ${sold} khách mua. Vui lòng chuyển sang trạng thái Ẩn (status=0) để ẩn khỏi shop nhưng vẫn giữ dữ liệu đơn.`,
    })
  }

  // ─── Guard 2: Top doanh thu (top 20% theo salesCount) → chặn (best-seller)
  const product = (await Product.findById(_id).select("salesCount title").lean()) as any
  if (product && product.salesCount > 0) {
    // Top 20% theo salesCount: đếm số product có salesCount >= của mình
    const totalProducts = await Product.countDocuments({})
    const betterOrEqual = await Product.countDocuments({
      salesCount: { $gte: product.salesCount },
    })
    const percentile = totalProducts > 0 ? betterOrEqual / totalProducts : 1
    if (percentile <= 0.2) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Không thể xóa mã nguồn best-seller (top 20% về doanh thu). Vui lòng chuyển sang trạng thái Ẩn (status=0) để bảo lưu lịch sử bán hàng.`,
      })
    }
  }

  await Product.deleteOne({ _id })
}

// ═══ ORDERS (đơn mã nguồn) ══════════════════════════════════════════════════

export interface AdminOrderListInput {
  page: number
  limit: number
  keyword?: string
}

export async function listAdminOrders(input: AdminOrderListInput) {
  const { page, limit, keyword } = input
  const skip = (page - 1) * limit

  // ─── Single roundtrip: $facet returning items + total ───
  const basePipeline: any[] = [
    { $sort: { orderDate: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { username: 1, fullname: 1 } }],
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
        pipeline: [{ $project: { title: 1, slug: 1, thumbnail: 1 } }],
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
  ]

  if (keyword) {
    const re = new RegExp(escapeRegex(keyword), "i")
    basePipeline.push({
      $match: {
        $or: [
          { "user.username": re },
          { "product.title": re },
        ],
      },
    })
  }

  const [result] = await Order.aggregate([
    ...basePipeline,
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: "total" }],
      },
    },
  ])

  const items = (result?.items ?? []) as any[]
  const total: number = result?.meta?.[0]?.total ?? 0

  return {
    items: items.map((o: any) => ({
      id: String(o._id),
      totalPrice: o.totalPrice,
      orderDate: o.orderDate,
      user: o.user
        ? { id: String(o.user._id), username: o.user.username, fullname: o.user.fullname }
        : null,
      product: o.product
        ? { id: String(o.product._id), title: o.product.title, slug: o.product.slug, thumbnail: o.product.thumbnail }
        : null,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

// ─── Order: get / update / delete ────────────────────────────────────

export async function getProductOrder(id: string) {
  const o = (await Order.findById(toObjectId(id))
    .populate("userId", "username fullname")
    .populate("productId", "title slug thumbnail")
    .lean()) as any
  if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
  return {
    id: String(o._id),
    totalPrice: o.totalPrice,
    orderDate: o.orderDate,
    user: o.userId
      ? { id: String(o.userId._id), username: o.userId.username, fullname: o.userId.fullname }
      : null,
    product: o.productId
      ? { id: String(o.productId._id), title: o.productId.title, slug: o.productId.slug, thumbnail: o.productId.thumbnail }
      : null,
  }
}

export interface ProductOrderUpdateInput {
  totalPrice?: number
  orderDate?: Date
}

export async function updateProductOrder(id: string, input: ProductOrderUpdateInput) {
  const _id = toObjectId(id)
  const update: Record<string, any> = {}
  if (typeof input.totalPrice === "number") update.totalPrice = Math.max(0, input.totalPrice)
  if (input.orderDate instanceof Date) update.orderDate = input.orderDate
  if (Object.keys(update).length === 0) return
  await Order.updateOne({ _id }, { $set: update })
}

export async function deleteProductOrder(id: string) {
  const _id = toObjectId(id)
  // Lấy order để sync salesCount trước khi xóa (atomic decrement)
  const order = (await Order.findById(_id).select("productId").lean()) as any
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy đơn" })
  }
  // Atomic: giảm salesCount + delete order trong cùng 1 batch
  await Promise.all([
    Order.deleteOne({ _id }),
    Product.updateOne(
      { _id: order.productId, salesCount: { $gt: 0 } },
      { $inc: { salesCount: -1 } }
    ),
  ])
}

// ─── Bulk Delete ───
export async function bulkDeleteProductCategories(ids: string[]) {
  const result = await Category.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeleteProducts(ids: string[]) {
  const result = await Product.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}

export async function bulkDeleteProductOrders(ids: string[]) {
  const result = await Order.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}
