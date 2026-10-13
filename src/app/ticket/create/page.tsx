import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { TicketCreateClient } from "./TicketCreateClient"

export const metadata = { title: "Tạo vé hỗ trợ" }

export default async function TicketCreatePage() {
  prefetch(trpc.ticket.createGuideConfig.queryOptions())

  return (
    <HydrateClient>
      <TicketCreateClient />
    </HydrateClient>
  )
}
