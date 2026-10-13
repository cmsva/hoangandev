/**
 * Server component cho /document-api.
 *
 * Prefetch:
 *  - apiKey.list — danh sách key của user (nếu đã login)
 *  - apiKey.usageStats — usage stats để hiển thị widget
 *
 * Metadata: dùng SEO catalog (key="document-api") nên admin có thể override.
 */
import type { Metadata } from "next"
import { getPageSeo } from "@/lib/seo-config"
import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { getSession } from "@/lib/session"
import { DocumentApiClient } from "./DocumentApiClient"

export async function generateMetadata(): Promise<Metadata> {
  return getPageSeo("document-api")
}

export default async function DocumentApiPage() {
  const session = await getSession()
  if (session) {
    prefetch(trpc.apiKey.list.queryOptions())
    prefetch(trpc.apiKey.usageStats.queryOptions())
  }
  return (
    <HydrateClient>
      <DocumentApiClient isAuthenticated={!!session} />
    </HydrateClient>
  )
}
