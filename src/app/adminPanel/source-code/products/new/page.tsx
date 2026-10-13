import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { AdminNewProductClient } from "./NewProductClient"

export const metadata = {
  title: "Tạo sản phẩm mã nguồn | Admin",
}

export default async function AdminNewProductPage() {
  prefetch(trpc.adminProduct.categoriesForSelect.queryOptions())

  return (
    <HydrateClient>
      <AdminNewProductClient />
    </HydrateClient>
  )
}
