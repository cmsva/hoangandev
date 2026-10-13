import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { CardClient } from "./CardClient"

export const metadata = {
  title: "Nạp thẻ cào | Admin Panel",
}

export default function AdminCardPage() {
  void Promise.all([
    prefetch(trpc.adminDeposit.getAdminCards.queryOptions({ limit: 500 })),
    prefetch(trpc.adminDeposit.getAdminCardConfig.queryOptions())
  ])

  return (
    <HydrateClient>
      <CardClient />
    </HydrateClient>
  )
}
