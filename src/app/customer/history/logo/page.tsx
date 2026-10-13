import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { LogoHistoryClient } from "./HistoryClient"

export const metadata = {
  title: "Logo đã thuê",
}

export default async function LogoHistoryPage() {
  prefetch(
    trpc.logo.myOrders.queryOptions({
      page: 1,
      limit: 10,
      sortField: "createdAt",
      sortDir: "desc",
    })
  )

  return (
    <HydrateClient>
      <LogoHistoryClient />
    </HydrateClient>
  )
}
