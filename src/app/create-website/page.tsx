import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { getPageSeo } from "@/lib/seo-config"
import { CreateWebsiteClient } from "./CreateWebsiteClient"

export const generateMetadata = () => getPageSeo("create-website")

export default async function CreateWebsitePage() {
  void Promise.all([
    prefetch(
    trpc.service.list.queryOptions({
    page: 1,
    limit: 12,
    sortField: "stt",
    sortDir: "asc",
    })
    ),
    prefetch(trpc.service.categories.queryOptions())
  ])

  return (
    <HydrateClient>
      <CreateWebsiteClient />
    </HydrateClient>
  )
}
