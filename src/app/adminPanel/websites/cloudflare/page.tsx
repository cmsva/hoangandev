import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminCloudflareClient } from "./CloudflareClient"

export const metadata = { title: "Cloudflare | Admin" }

export default async function AdminCloudflarePage() {
  prefetch(trpc.adminWebsite.listCloudflareAccounts.queryOptions({ page: 1, limit: 50 }))

  return <HydrateClient><AdminCloudflareClient /></HydrateClient>
}
