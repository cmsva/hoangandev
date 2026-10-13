import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { CouponClient } from "./CouponClient"

export const metadata = {
  title: "Mã giảm giá | Admin Panel",
}

export default async function AdminCouponsPage() {
  prefetch(trpc.adminCoupon.list.queryOptions({ page: 1, limit: 20 }))

  return (
    <HydrateClient>
      <CouponClient />
    </HydrateClient>
  )
}
