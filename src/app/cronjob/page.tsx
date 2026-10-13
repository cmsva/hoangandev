import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { getPageSeo } from "@/lib/seo-config"
import { CronjobClient } from "./CronjobClient"

export const generateMetadata = () => getPageSeo("cronjob")

export default async function CronjobPage() {
  prefetch(trpc.cronjob.listServers.queryOptions())

  return (
    <HydrateClient>
      <CronjobClient />
    </HydrateClient>
  )
}
