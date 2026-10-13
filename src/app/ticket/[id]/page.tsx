import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { TicketDetailClient } from "./TicketDetailClient"

export const metadata = { title: "Chi tiết vé hỗ trợ" }

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  prefetch(trpc.ticket.getById.queryOptions({ id }))

  return (
    <HydrateClient>
      <TicketDetailClient id={id} />
    </HydrateClient>
  )
}
