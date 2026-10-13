import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminWebsiteTemplatesClient } from "./WebsiteTemplatesClient"

export const metadata = { title: "Mẫu Website | Admin" }

export default function AdminWebsiteTemplatesPage() {
  prefetch(trpc.adminWebsite.listTemplates.queryOptions({ page: 1, limit: 50 }))

  return (
    <HydrateClient>
      <AdminWebsiteTemplatesClient />
    </HydrateClient>
  )
}
