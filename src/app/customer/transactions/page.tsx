import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { TransactionsClient } from "./TransactionsClient"

export const metadata = {
  title: "Lịch sử giao dịch",
}

export default async function TransactionsPage() {
  prefetch(trpc.dashboard.myTransactions.queryOptions({ page: 1, limit: 10 }))

  return (
    <HydrateClient>
      <TransactionsClient />
    </HydrateClient>
  )
}
