import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminBalanceLogsClient } from "./BalanceLogsClient"

export const metadata = {
  title: "Balance logs | Admin",
}

export default async function AdminBalanceLogsPage() {
  prefetch(trpc.admin.getBalanceLogs.queryOptions({ page: 1, limit: 50 }))

  return (
    <HydrateClient>
      <AdminBalanceLogsClient />
    </HydrateClient>
  )
}
