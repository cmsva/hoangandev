/**
 * Static Page Service (public read) — protocol-agnostic.
 */
import { StaticPage, type IStaticPage } from "@/models/static-page.model"

export interface PublicStaticPage {
  slug: string
  title: string
  description: string | null
  keywords: string[]
  content: string
  requireLogin: boolean
}

/**
 * Tìm trang tĩnh đang hiển thị theo slug. Trả null nếu không có / bị ẩn.
 */
export async function findStaticPageBySlug(slug: string): Promise<PublicStaticPage | null> {
  const normalized = slug.toLowerCase().trim()
  const page = (await StaticPage.findOne({ slug: normalized, status: 1 })
    .select("slug title description keywords content requireLogin")
    .lean()) as unknown as IStaticPage | null
  if (!page) return null
  return {
    slug: page.slug,
    title: page.title,
    description: page.description ?? null,
    keywords: page.keywords ?? [],
    content: page.content ?? "",
    requireLogin: !!page.requireLogin,
  }
}

/** Tăng view best-effort (không block). */
export async function incrementStaticPageView(slug: string): Promise<void> {
  await StaticPage.updateOne({ slug: slug.toLowerCase().trim() }, { $inc: { view: 1 } }).catch(() => {})
}
