/**
 * Admin Static Page Service — CRUD + bulk cho trang tĩnh.
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { StaticPage } from "@/models/static-page.model"
import { escapeRegex } from "@/lib/sanitize"

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

// Slug bị cấm — trùng route tĩnh đang có
const RESERVED_SLUGS = new Set([
  "adminPanel", "api", "authentication", "blogs", "cmstdev", "contact",
  "create-logo", "create-website", "cronjob", "customer", "dashboard",
  "domain", "maintenance", "reffer", "source-code", "ticket", "_next",
])

async function ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
  let base = slug || `trang-${Date.now().toString(36)}`
  if (RESERVED_SLUGS.has(base)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Slug "${base}" trùng với đường dẫn hệ thống, vui lòng chọn slug khác`,
    })
  }
  const filter: Record<string, unknown> = { slug: base }
  if (excludeId) filter._id = { $ne: toObjectId(excludeId) }
  const exists = await StaticPage.findOne(filter).select("_id").lean()
  return exists ? `${base}-${Date.now().toString(36)}` : base
}

export interface AdminStaticPageListInput {
  page: number
  limit: number
  keyword?: string
  status?: number
}

export async function listAdminStaticPages(input: AdminStaticPageListInput) {
  const skip = (input.page - 1) * input.limit
  const filter: Record<string, unknown> = {}
  if (typeof input.status === "number") filter.status = input.status
  if (input.keyword) {
    const rx = { $regex: escapeRegex(input.keyword), $options: "i" }
    filter.$or = [{ title: rx }, { slug: rx }]
  }

  const [items, total] = await Promise.all([
    StaticPage.find(filter)
      .select("slug title requireLogin status view createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(input.limit)
      .lean(),
    StaticPage.countDocuments(filter),
  ])

  return {
    items: items.map((p: any) => ({
      id: String(p._id),
      slug: p.slug,
      title: p.title,
      requireLogin: !!p.requireLogin,
      status: p.status,
      view: p.view ?? 0,
      createdAt: p.createdAt,
    })),
    total,
    page: input.page,
    limit: input.limit,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  }
}

export async function getAdminStaticPage(id: string) {
  const p = (await StaticPage.findById(toObjectId(id)).lean()) as any
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy trang" })
  return {
    id: String(p._id),
    slug: p.slug,
    title: p.title,
    description: p.description ?? "",
    keywords: p.keywords ?? [],
    content: p.content ?? "",
    requireLogin: !!p.requireLogin,
    status: p.status,
  }
}

export interface StaticPageUpsertInput {
  slug?: string
  title: string
  description?: string | null
  keywords?: string[]
  content?: string
  requireLogin?: boolean
  status?: number
}

export async function createStaticPage(input: StaticPageUpsertInput) {
  const slug = await ensureUniqueSlug(slugify(input.slug || input.title))
  const doc = await StaticPage.create({
    slug,
    title: input.title.trim(),
    description: input.description ?? null,
    keywords: input.keywords ?? [],
    content: input.content ?? "",
    requireLogin: input.requireLogin ?? false,
    status: input.status ?? 1,
  })
  return { id: String(doc._id), slug }
}

export async function updateStaticPage(id: string, input: StaticPageUpsertInput) {
  const update: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description ?? null,
    keywords: input.keywords ?? [],
    content: input.content ?? "",
    requireLogin: input.requireLogin ?? false,
    status: input.status ?? 1,
  }
  if (input.slug) update.slug = await ensureUniqueSlug(slugify(input.slug), id)
  await StaticPage.updateOne({ _id: toObjectId(id) }, { $set: update })
}

export async function deleteStaticPage(id: string) {
  await StaticPage.deleteOne({ _id: toObjectId(id) })
}

export async function bulkDeleteStaticPages(ids: string[]) {
  const result = await StaticPage.deleteMany({ _id: { $in: ids } })
  return { deleted: result.deletedCount }
}
