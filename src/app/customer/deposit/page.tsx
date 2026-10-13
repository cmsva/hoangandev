import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { DepositClient } from "./DepositClient"

export const metadata = {
  title: "Nạp tiền",
}

export default async function DepositPage() {
  void Promise.all([
    prefetch(trpc.deposit.getBanks.queryOptions()),
    prefetch(trpc.deposit.getSettings.queryOptions()),
    prefetch(trpc.deposit.getPromotions.queryOptions()),
    prefetch(trpc.deposit.getInvoices.queryOptions())
  ])

  return (
    <HydrateClient>
      <DepositClient />
    </HydrateClient>
  )
}
