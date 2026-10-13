import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { getPageSeo } from "@/lib/seo-config"
import { BlogsClient } from "./BlogsClient"

export const generateMetadata = () => getPageSeo("blogs")

export default async function BlogsPage() {
  void Promise.all([
    prefetch(trpc.post.list.queryOptions({ page: 1, limit: 12 })),
    prefetch(trpc.post.categories.queryOptions())
  ])
  return <HydrateClient><BlogsClient /></HydrateClient>
}
