import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminWebsiteOrdersClient } from "./WebsiteOrdersClient"

export const metadata = { title: "Đơn website | Admin" }

export default async function AdminWebsiteOrdersPage() {
  prefetch(trpc.adminWebsite.listOrders.queryOptions({ page: 1, limit: 20 }))

  return (
    <HydrateClient>
      <AdminWebsiteOrdersClient />
    </HydrateClient>
  )
}
