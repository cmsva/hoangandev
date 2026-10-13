import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminCronjobServersClient } from "./CronjobServersClient"

export const metadata = {
  title: "Server Cronjob | Admin",
}

export default async function AdminCronjobServersPage() {
  prefetch(trpc.adminCronjob.listServers.queryOptions({ page: 1, limit: 20 }))

  return (
    <HydrateClient>
      <AdminCronjobServersClient />
    </HydrateClient>
  )
}
