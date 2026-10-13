"use client"

// (no client-only React imports needed)
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { ProductForm } from "@/components/admin/product-form"
import { Skeleton } from "@/components/ui/skeleton"
import { IconBracketsCurly } from "@/components/icons"

export function AdminEditProductClient({ id }: { id: string }) {
  const trpc = useTRPC()

  const { data: product, isLoading: loadingProduct } = useQuery(
    trpc.adminProduct.getProduct.queryOptions({ id })
  ) as { data: any; isLoading: boolean }

  const { data: cats, isLoading: loadingCats } = useQuery(
    trpc.adminProduct.categoriesForSelect.queryOptions()
  ) as { data: any[] | undefined; isLoading: boolean }

  const isLoading = loadingProduct || loadingCats

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a>
          <ChevronRight />
          <span>Mã nguồn</span>
          <ChevronRight />
          <a href="/adminPanel/source-code/products" className="hover:text-foreground transition-colors">Sản phẩm</a>
          <ChevronRight />
          <span className="text-foreground">Chỉnh sửa</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600">
            <IconBracketsCurly size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {product?.title || "Chỉnh sửa mã nguồn"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Cập nhật thông tin và nội dung mã nguồn.
            </p>
          </div>
        </div>
      </div>

      {isLoading || !product || !cats ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      ) : (
        <ProductForm
          productId={product.id}
          initialData={{
            title: product.title,
            slug: product.slug,
            description: product.description ?? "",
            detail: product.detail ?? "",
            price: product.price,
            salePrice: product.salePrice,
            discountPercentage: product.discountPercentage,
            categoryId: product.categoryId,
            thumbnail: product.thumbnail,
            images: product.images ?? [],
            fileUrl: product.fileUrl,
            status: product.status,
            isFree: product.isFree,
            approved: product.approved,
            tags: product.tags ?? [],
          }}
          categories={cats}
        />
      )}
    </div>
  )
}

function ChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
}
