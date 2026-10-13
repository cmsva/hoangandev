import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { RewardsClient } from "./RewardsClient"

export const metadata = {
  title: "Điểm thưởng",
}

export default async function RewardsPage() {
  void Promise.all([
    prefetch(trpc.rewards.summary.queryOptions()),
    prefetch(trpc.rewards.config.queryOptions()),
    prefetch(trpc.rewards.history.queryOptions({ type: "all", page: 1, limit: 20 })),
  ])

  return (
    <HydrateClient>
      <RewardsClient />
    </HydrateClient>
  )
}
