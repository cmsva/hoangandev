import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AffiliateConfigClient } from "./AffiliateConfigClient"

export const metadata = {
  title: "Cấu hình affiliate | Admin Panel",
}

export default async function AdminAffiliateConfigPage() {
  prefetch(trpc.adminAffiliate.getConfig.queryOptions())

  return (
    <HydrateClient>
      <AffiliateConfigClient />
    </HydrateClient>
  )
}
