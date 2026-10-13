import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { WebsiteHistoryClient } from "./HistoryClient"

export const metadata = {
  title: "Website đã tạo",
}

export default async function WebsiteHistoryPage() {
  prefetch(
    trpc.service.myOrders.queryOptions({
      page: 1,
      limit: 10,
      sortDir: "desc",
    })
  )

  return (
    <HydrateClient>
      <WebsiteHistoryClient />
    </HydrateClient>
  )
}
