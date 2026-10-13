import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminDomainOrdersClient } from "./DomainOrdersClient"

export const metadata = {
  title: "Đơn hàng tên miền | Admin",
}

export default async function AdminDomainOrdersPage() {
  prefetch(trpc.adminDomain.listOrders.queryOptions({ page: 1, limit: 20 }))

  return (
    <HydrateClient>
      <AdminDomainOrdersClient />
    </HydrateClient>
  )
}
