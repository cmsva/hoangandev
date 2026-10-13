import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AffiliateLogsClient } from "./AffiliateLogsClient"

export const metadata = {
  title: "Nhật ký hoa hồng | Admin Panel",
}

export default async function AdminAffiliateLogsPage() {
  prefetch(trpc.adminAffiliate.listLogs.queryOptions({ page: 1, limit: 20 }))

  return (
    <HydrateClient>
      <AffiliateLogsClient />
    </HydrateClient>
  )
}
