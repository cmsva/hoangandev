import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { TicketHistoryClient } from "./TicketHistoryClient"

export const metadata = { title: "Lịch sử vé hỗ trợ" }

export default async function TicketHistoryPage() {
  prefetch(trpc.ticket.list.queryOptions({ page: 1, limit: 10 }))
  return (
    <HydrateClient>
      <TicketHistoryClient />
    </HydrateClient>
  )
}
