import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminCronjobOrdersClient } from "./CronjobOrdersClient"

export const metadata = {
  title: "Đơn hàng Cronjob | Admin",
}

export default async function AdminCronjobOrdersPage() {
  prefetch(trpc.adminCronjob.listOrders.queryOptions({ page: 1, limit: 20 }))

  return (
    <HydrateClient>
      <AdminCronjobOrdersClient />
    </HydrateClient>
  )
}
