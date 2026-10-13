import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminStaticPagesClient } from "./StaticPagesClient"

export const metadata = { title: "Trang tĩnh | Admin Panel" }

export default async function AdminStaticPagesPage() {
  void prefetch(trpc.adminStaticPage.list.queryOptions({ page: 1, limit: 20 }))
  return <HydrateClient><AdminStaticPagesClient /></HydrateClient>
}
