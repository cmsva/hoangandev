import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { PromotionsClient } from "./PromotionsClient"

export const metadata = {
  title: "Khuyến mãi nạp | Admin Panel",
}

export default async function AdminPromotionsPage() {
  prefetch(trpc.adminDeposit.getAdminPromotions.queryOptions())

  return (
    <HydrateClient>
      <PromotionsClient />
    </HydrateClient>
  )
}
