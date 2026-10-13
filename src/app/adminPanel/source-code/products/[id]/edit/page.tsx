import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminEditProductClient } from "./EditProductClient"

export const metadata = {
  title: "Chỉnh sửa mã nguồn | Admin",
}

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  void Promise.all([
    prefetch(trpc.adminProduct.getProduct.queryOptions({ id })),
    prefetch(trpc.adminProduct.categoriesForSelect.queryOptions())
  ])

  return (
    <HydrateClient>
      <AdminEditProductClient id={id} />
    </HydrateClient>
  )
}
