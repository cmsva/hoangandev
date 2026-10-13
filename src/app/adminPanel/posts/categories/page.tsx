import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminPostCategoriesClient } from "./PostCategoriesClient"

export const metadata = {
  title: "Chuyên mục bài viết | Admin",
}

export default async function AdminPostCategoriesPage() {
  prefetch(trpc.adminPost.listCategories.queryOptions({ page: 1, limit: 20 }))

  return (
    <HydrateClient>
      <AdminPostCategoriesClient />
    </HydrateClient>
  )
}
