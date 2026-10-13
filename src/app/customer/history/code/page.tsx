/**
 * Customer order history (mã nguồn đã mua) — RSC.
 *
 * Prefetch order.myOrders với default page=1, limit=10, sort orderDate desc.
 * Khi user filter/sort, client query sẽ refetch — initial render không có flash.
 */
import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { OrderHistoryClient } from "./OrderHistoryClient"

export const metadata = {
  title: "Mã nguồn đã mua",
}

export default async function OrderHistoryPage() {
  prefetch(
    trpc.order.myOrders.queryOptions({
      page: 1,
      limit: 10,
      sortField: "orderDate",
      sortDir: "desc",
    })
  )

  return (
    <HydrateClient>
      <OrderHistoryClient />
    </HydrateClient>
  )
}
