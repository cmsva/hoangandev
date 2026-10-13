import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminCategoriesClient } from "./CategoriesClient"

export const metadata = {
  title: "Danh mục mã nguồn | Admin",
}

export default async function AdminCategoriesPage() {
  prefetch(trpc.adminProduct.listCategories.queryOptions({ page: 1, limit: 50 }))

  return (
    <HydrateClient>
      <AdminCategoriesClient />
    </HydrateClient>
  )
}
