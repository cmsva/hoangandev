import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminNewWebsiteTemplateClient } from "./NewWebsiteTemplateClient"

export const metadata = { title: "Thêm mẫu website | Admin" }

export default function AdminNewWebsiteTemplatePage() {
  void Promise.all([
    prefetch(trpc.adminWebsite.categoriesForSelect.queryOptions()),
    prefetch(trpc.adminWebsite.listDeployCodes.queryOptions({ page: 1, limit: 100 }))
  ])

  return (
    <HydrateClient>
      <AdminNewWebsiteTemplateClient />
    </HydrateClient>
  )
}
