import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminTicketsClient } from "./AdminTicketsClient"

export const metadata = { title: "Quản lý vé hỗ trợ | Admin" }

export default function AdminTicketsPage() {
  void Promise.all([
    prefetch(trpc.adminTicket.list.queryOptions({ page: 1, limit: 20 })),
    prefetch(trpc.adminTicket.getCreateGuideConfig.queryOptions())
  ])

  return (
    <HydrateClient>
      <AdminTicketsClient />
    </HydrateClient>
  )
}
