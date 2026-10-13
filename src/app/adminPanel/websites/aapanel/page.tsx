import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminAaPanelClient } from "./AaPanelClient"

export const metadata = { title: "aaPanel | Admin" }

export default async function AdminAaPanelPage() {
  prefetch(trpc.adminWebsite.listAaPanelServers.queryOptions({ page: 1, limit: 50 }))

  return <HydrateClient><AdminAaPanelClient /></HydrateClient>
}
