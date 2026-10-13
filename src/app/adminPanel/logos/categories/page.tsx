import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminLogoCategoriesClient } from "./LogoCategoriesClient"

export const metadata = {
  title: "Danh mục logo | Admin",
}

export default async function AdminLogoCategoriesPage() {
  prefetch(trpc.adminLogo.listCategories.queryOptions({ page: 1, limit: 50 }))

  return (
    <HydrateClient>
      <AdminLogoCategoriesClient />
    </HydrateClient>
  )
}
