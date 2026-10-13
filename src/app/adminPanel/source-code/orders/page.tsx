import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminProductOrdersClient } from "./OrdersClient"

export const metadata = {
  title: "Đơn hàng mã nguồn | Admin",
}

export default async function AdminProductOrdersPage() {
  prefetch(trpc.adminProduct.listOrders.queryOptions({ page: 1, limit: 20 }))

  return (
    <HydrateClient>
      <AdminProductOrdersClient />
    </HydrateClient>
  )
}
