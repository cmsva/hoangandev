import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { DomainHistoryClient } from "./HistoryClient"

export const metadata = {
  title: "Tên miền đã mua",
}

export default async function DomainHistoryPage() {
  prefetch(
    trpc.domain.myOrders.queryOptions({
      page: 1,
      limit: 10,
      sortField: "createdAt",
      sortDir: "desc",
    })
  )

  return (
    <HydrateClient>
      <DomainHistoryClient />
    </HydrateClient>
  )
}
