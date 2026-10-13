import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { WritePostClient } from "./WritePostClient"

export const metadata = { title: "Viết bài mới | Admin" }

export default async function WritePostPage() {
  prefetch(trpc.adminPost.categoriesForSelect.queryOptions())
  return <HydrateClient><WritePostClient /></HydrateClient>
}
