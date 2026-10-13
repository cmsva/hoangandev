import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { TelcosClient } from "./TelcosClient"

export const metadata = {
  title: "Nhà mạng thẻ cào | Admin Panel",
}

export default function AdminTelcosPage() {
  prefetch(trpc.adminDeposit.getAdminTelcos.queryOptions())

  return (
    <HydrateClient>
      <TelcosClient />
    </HydrateClient>
  )
}
