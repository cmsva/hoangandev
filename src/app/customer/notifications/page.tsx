import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { NotificationsClient } from "./NotificationsClient"

export const metadata = {
  title: "Thông báo",
}

export default async function NotificationsPage() {
  void prefetch(trpc.notification.list.queryOptions({ page: 1, limit: 20, onlyUnread: false }))
  return (
    <HydrateClient>
      <NotificationsClient />
    </HydrateClient>
  )
}
