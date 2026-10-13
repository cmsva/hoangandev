import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { CardClient } from "./CardClient"

export const metadata = { title: "Nạp thẻ cào" }

export default async function CardPage() {
  void Promise.all([
    prefetch(trpc.card.getSettings.queryOptions()),
    prefetch(trpc.card.getTelcos.queryOptions()),
    prefetch(trpc.card.getHistory.queryOptions())
  ])

  return (
    <HydrateClient>
      <CardClient />
    </HydrateClient>
  )
}
