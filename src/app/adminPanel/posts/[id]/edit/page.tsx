import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminEditPostClient } from "./EditPostClient"

export const metadata = { title: "Sửa bài viết | Admin" }

export default async function AdminEditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  void Promise.all([
    prefetch(trpc.adminPost.getPost.queryOptions({ id })),
    prefetch(trpc.adminPost.categoriesForSelect.queryOptions())
  ])
  return <HydrateClient><AdminEditPostClient id={id} /></HydrateClient>
}
