import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminDashboardClient } from "./DashboardClient"

export const metadata = {
  title: "Admin Dashboard",
}

export default async function AdminDashboardPage() {
  void Promise.all([
    prefetch(trpc.admin.getStats.queryOptions({ range: "today" })),
    prefetch(trpc.admin.getServerInfo.queryOptions())
  ])

  return (
    <HydrateClient>
      <AdminDashboardClient />
    </HydrateClient>
  )
}
