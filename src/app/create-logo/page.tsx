import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { getPageSeo } from "@/lib/seo-config"
import { CreateLogoClient } from "./CreateLogoClient"

export const generateMetadata = () => getPageSeo("create-logo")

export default async function CreateLogoPage() {
  void Promise.all([
    prefetch(trpc.logo.categories.queryOptions()),
    prefetch(
    trpc.logo.list.queryOptions({
    page: 1,
    limit: 12,
    sortField: "stt",
    sortDir: "asc",
    })
    )
  ])

  return (
    <HydrateClient>
      <CreateLogoClient />
    </HydrateClient>
  )
}
