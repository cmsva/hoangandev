import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AffiliateHistoryClient } from "./HistoryClient"

export const metadata = {
  title: "Lịch sử hoa hồng",
}

export default async function AffiliateHistoryPage() {
  void Promise.all([
    prefetch(trpc.affiliate.getStats.queryOptions()),
    prefetch(
    trpc.affiliate.getHistory.queryOptions({
    page: 1,
    limit: 20,
    })
    )
  ])

  return (
    <HydrateClient>
      <AffiliateHistoryClient />
    </HydrateClient>
  )
}
