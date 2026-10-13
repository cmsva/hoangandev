import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminLogosClient } from "./LogosListClient"

export const metadata = {
  title: "Logo | Admin",
}

export default async function AdminLogosPage() {
  void Promise.all([
    prefetch(trpc.adminLogo.listLogos.queryOptions({ page: 1, limit: 20 })),
    prefetch(trpc.adminLogo.categoriesForSelect.queryOptions())
  ])

  return (
    <HydrateClient>
      <AdminLogosClient />
    </HydrateClient>
  )
}
