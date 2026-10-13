import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { getPageSeo } from "@/lib/seo-config"
import { SourceCodeClient } from "./SourceCodeClient"

export const generateMetadata = () => getPageSeo("source-code")

export default async function SourceCodePage() {
  void Promise.all([
    prefetch(trpc.product.list.queryOptions({ page: 1, limit: 12 })),
    prefetch(trpc.product.categories.queryOptions())
  ])

  return (
    <HydrateClient>
      <SourceCodeClient />
    </HydrateClient>
  )
}
