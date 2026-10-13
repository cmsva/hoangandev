import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AffiliateOverviewClient } from "./AffiliateOverviewClient"

export const metadata = { title: "Tiếp thị liên kết" }

export default async function AffiliateOverviewPage() {
  void Promise.all([
    prefetch(trpc.affiliate.getStats.queryOptions()),
    prefetch(trpc.affiliate.getHistory.queryOptions({ page: 1, limit: 20 }))
  ])

  return (
    <HydrateClient>
      <AffiliateOverviewClient />
    </HydrateClient>
  )
}
