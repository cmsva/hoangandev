import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminEditWebsiteTemplateClient } from "./EditWebsiteTemplateClient"

export const metadata = { title: "Sửa mẫu website | Admin" }

export default async function AdminEditWebsiteTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  void Promise.all([
    prefetch(trpc.adminWebsite.getTemplate.queryOptions({ id })),
    prefetch(trpc.adminWebsite.categoriesForSelect.queryOptions()),
    prefetch(trpc.adminWebsite.listDeployCodes.queryOptions({ page: 1, limit: 100 }))
  ])

  return (
    <HydrateClient>
      <AdminEditWebsiteTemplateClient id={id} />
    </HydrateClient>
  )
}
