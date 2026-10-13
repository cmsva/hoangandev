import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminPostsClient } from "./PostsClient"

export const metadata = { title: "Danh sách post | Admin" }

export default async function AdminPostsPage() {
  void Promise.all([
    prefetch(trpc.adminPost.listPosts.queryOptions({ page: 1, limit: 20 })),
    prefetch(trpc.adminPost.categoriesForSelect.queryOptions())
  ])
  return <HydrateClient><AdminPostsClient /></HydrateClient>
}
