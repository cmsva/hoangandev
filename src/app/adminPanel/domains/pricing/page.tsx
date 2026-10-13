import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminDomainPricingClient } from "./DomainPricingClient"

export const metadata = {
  title: "Bảng giá tên miền | Admin",
}

export default async function AdminDomainPricingPage() {
  void Promise.all([
    prefetch(trpc.adminDomain.listTlds.queryOptions({ page: 1, limit: 50 })),
    prefetch(trpc.adminDomain.getSpaceshipConfig.queryOptions())
  ])

  return (
    <HydrateClient>
      <AdminDomainPricingClient />
    </HydrateClient>
  )
}
