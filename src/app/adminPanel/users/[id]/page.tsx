import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminUserDetailClient } from "./UserDetailClient"

export const metadata = {
  title: "Chi tiết user | Admin",
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  prefetch(trpc.adminUser.detail.queryOptions({ id }))

  return (
    <HydrateClient>
      <AdminUserDetailClient id={id} />
    </HydrateClient>
  )
}
