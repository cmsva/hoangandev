/**
 * Admin SEO Service — quản lý override SEO theo key (catalog page code cứng).
 */
import { PageSeo } from "@/models/page-seo.model"
import { PAGE_SEO_CATALOG, invalidatePageSeoCache } from "@/lib/seo-config"

/**
 * List toàn bộ catalog kèm giá trị override hiện tại (nếu có).
 */
export async function listSeoEntries() {
  const docs = await PageSeo.find({}).lean<
    Array<{ key: string; title: string | null; description: string | null; keywords: string[]; ogImage: string | null }>
  >()
  const map = new Map(docs.map((d) => [d.key, d]))

  return PAGE_SEO_CATALOG.map((entry) => {
    const ov = map.get(entry.key)
    return {
      key: entry.key,
      label: entry.label,
      path: entry.path,
      group: entry.group,
      noIndex: !!entry.noIndex,
      defaultTitle: entry.defaultTitle,
      defaultDescription: entry.defaultDescription,
      title: ov?.title ?? "",
      description: ov?.description ?? "",
      keywords: ov?.keywords ?? [],
      ogImage: ov?.ogImage ?? "",
    }
  })
}

export interface SeoUpsertInput {
  key: string
  title?: string | null
  description?: string | null
  keywords?: string[]
  ogImage?: string | null
}

const VALID_KEYS = new Set(PAGE_SEO_CATALOG.map((e) => e.key))

/**
 * Lưu override cho 1 key. Field rỗng → null (fallback về default).
 */
export async function saveSeoEntry(input: SeoUpsertInput) {
  if (!VALID_KEYS.has(input.key)) {
    throw new Error("Key SEO không hợp lệ")
  }
  await PageSeo.updateOne(
    { key: input.key },
    {
      $set: {
        key: input.key,
        title: input.title?.trim() || null,
        description: input.description?.trim() || null,
        keywords: input.keywords ?? [],
        ogImage: input.ogImage?.trim() || null,
      },
    },
    { upsert: true }
  )
  invalidatePageSeoCache()
  return { success: true }
}
