import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { WithdrawClient } from "./WithdrawClient"

export const metadata = { title: "Rút hoa hồng" }

export default async function AffiliateWithdrawPage() {
  void Promise.all([
    prefetch(trpc.affiliate.getConfig.queryOptions()),
    prefetch(trpc.affiliate.getStats.queryOptions()),
    prefetch(trpc.affiliate.getWithdrawHistory.queryOptions({ page: 1, limit: 20 }))
  ])

  return (
    <HydrateClient>
      <WithdrawClient />
    </HydrateClient>
  )
}
