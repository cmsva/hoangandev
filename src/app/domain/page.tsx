import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { getPageSeo } from "@/lib/seo-config"
import { DomainClient } from "./DomainClient"

export const generateMetadata = () => getPageSeo("domain")

export default async function DomainPage() {
  prefetch(
    trpc.domain.listTlds.queryOptions({
      page: 1,
      limit: 20,
      activeOnly: true,
    })
  )

  return (
    <HydrateClient>
      <DomainClient />
    </HydrateClient>
  )
}
