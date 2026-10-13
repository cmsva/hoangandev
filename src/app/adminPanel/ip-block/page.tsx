import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminIpBlockClient } from "./IpBlockClient"

export const metadata = {
  title: "Chặn truy cập | Admin Panel",
  description: "Quản lý danh sách IP bị chặn truy cập website.",
  robots: { index: false, follow: false },
}

export default async function AdminIpBlockPage() {
  prefetch(trpc.adminIpBlock.list.queryOptions({ page: 1, limit: 20 }))
  return (
    <HydrateClient>
      <AdminIpBlockClient />
    </HydrateClient>
  )
}
