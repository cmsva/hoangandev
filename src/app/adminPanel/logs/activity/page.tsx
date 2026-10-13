import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminActivityLogsClient } from "./ActivityLogsClient"

export const metadata = {
  title: "Activity logs | Admin",
}

export default async function AdminActivityLogsPage() {
  prefetch(trpc.admin.getActivityLogs.queryOptions({ page: 1, limit: 50 }))

  return (
    <HydrateClient>
      <AdminActivityLogsClient />
    </HydrateClient>
  )
}
