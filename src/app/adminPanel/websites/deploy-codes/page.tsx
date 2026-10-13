import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminDeployCodesClient } from "./DeployCodesClient"

export const metadata = { title: "Code deploy | Admin" }

export default function AdminDeployCodesPage() {
  prefetch(trpc.adminWebsite.listDeployCodes.queryOptions({ page: 1, limit: 50 }))

  return (
    <HydrateClient>
      <AdminDeployCodesClient />
    </HydrateClient>
  )
}
