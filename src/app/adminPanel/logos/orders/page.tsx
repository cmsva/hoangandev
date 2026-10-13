import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminLogoOrdersClient } from "./LogoOrdersClient"

export const metadata = {
  title: "Đơn hàng logo | Admin",
}

export default async function AdminLogoOrdersPage() {
  prefetch(trpc.adminLogo.listOrders.queryOptions({ page: 1, limit: 20 }))

  return (
    <HydrateClient>
      <AdminLogoOrdersClient />
    </HydrateClient>
  )
}
