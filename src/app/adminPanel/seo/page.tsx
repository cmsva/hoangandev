import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { SeoConfigClient } from "./SeoConfigClient"

export const metadata = { title: "Cấu hình SEO | Admin" }

export default async function AdminSeoPage() {
  void prefetch(trpc.adminSeo.list.queryOptions())
  return <HydrateClient><SeoConfigClient /></HydrateClient>
}
