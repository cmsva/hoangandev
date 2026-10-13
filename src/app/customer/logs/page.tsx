import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { ActivityLogsClient } from "./ActivityLogsClient"

export const metadata = {
  title: "Nhật ký hoạt động",
}

export default async function ActivityLogsPage() {
  prefetch(trpc.dashboard.myLogs.queryOptions({ page: 1, limit: 10 }))

  return (
    <HydrateClient>
      <ActivityLogsClient />
    </HydrateClient>
  )
}
