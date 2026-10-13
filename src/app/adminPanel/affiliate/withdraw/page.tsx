import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AffiliateWithdrawClient } from "./AffiliateWithdrawClient"

export const metadata = {
  title: "Yêu cầu rút affiliate | Admin Panel",
}

export default async function AdminAffiliateWithdrawPage() {
  prefetch(trpc.adminAffiliate.listWithdraws.queryOptions({ page: 1, limit: 20 }))

  return (
    <HydrateClient>
      <AffiliateWithdrawClient />
    </HydrateClient>
  )
}
