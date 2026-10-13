"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { ProductForm, newProductFormData } from "@/components/admin/product-form"
import { Skeleton } from "@/components/ui/skeleton"
import { IconBracketsCurly } from "@/components/icons"

export function AdminNewProductClient() {
  const trpc = useTRPC()
  const { data: cats, isLoading } = useQuery(
    trpc.adminProduct.categoriesForSelect.queryOptions()
  ) as { data: any[] | undefined; isLoading: boolean }

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
          <span className="text-foreground">Thêm mới</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600">
            <IconBracketsCurly size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Thêm mã nguồn mới</h1>
            <p className="text-sm text-muted-foreground">
              Điền đầy đủ thông tin để hiển thị đẹp ở trang chi tiết.
            </p>
          </div>
        </div>
      </div>

      {isLoading || !cats ? (
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
        <ProductForm productId={null} initialData={newProductFormData()} categories={cats} />
      )}
    </div>
  )
}

function ChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
}
