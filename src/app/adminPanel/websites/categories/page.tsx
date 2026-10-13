import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminWebsiteCategoriesClient } from "./WebsiteCategoriesClient"

export const metadata = { title: "Danh mục website | Admin" }

export default function AdminWebsiteCategoriesPage() {
  prefetch(trpc.adminWebsite.listCategories.queryOptions({ page: 1, limit: 50 }))

  return (
    <HydrateClient>
      <AdminWebsiteCategoriesClient />
    </HydrateClient>
  )
}
