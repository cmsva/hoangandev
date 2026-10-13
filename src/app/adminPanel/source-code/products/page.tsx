import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminProductsClient } from "./ProductsClient"

export const metadata = {
  title: "Sản phẩm mã nguồn | Admin",
}

export default async function AdminProductsPage() {
  void Promise.all([
    prefetch(trpc.adminProduct.listProducts.queryOptions({ page: 1, limit: 20 })),
    prefetch(trpc.adminProduct.categoriesForSelect.queryOptions())
  ])

  return (
    <HydrateClient>
      <AdminProductsClient />
    </HydrateClient>
  )
}
