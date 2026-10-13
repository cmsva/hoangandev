import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminUsersClient } from "./UsersClient"

export const metadata = {
  title: "Khách hàng | Admin",
}

export default async function AdminUsersPage() {
  void Promise.all([
    prefetch(trpc.adminUser.stats.queryOptions()),
    prefetch(trpc.adminUser.list.queryOptions({ page: 1, limit: 20 }))
  ])

  return (
    <HydrateClient>
      <AdminUsersClient />
    </HydrateClient>
  )
}
