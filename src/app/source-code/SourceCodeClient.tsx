"use client"

import { useEffect, useState, memo } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useTRPC } from "@/trpc/client"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { IconSearch } from "@/components/icons"
import { Skeleton } from "@/components/ui/skeleton"

export function SourceCodeClient() {
  const { collapsed } = useSidebar()
  const trpc = useTRPC()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Debounce search 300ms — giảm số request khi user gõ
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput.trim())
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput, search])

  const { data, isLoading, isFetching } = useQuery({
    ...trpc.product.list.queryOptions({
      page,
      limit: 12,
      search: search || undefined,
      categoryId,
    }),
    placeholderData: keepPreviousData, // Giữ data cũ khi đổi page → no flicker
  }) as { data: any; isLoading: boolean; isFetching: boolean }

  const { data: categories } = useQuery(
    trpc.product.categories.queryOptions()
  ) as { data: any[] | undefined }

  if (!isMounted) {
    return <div className="flex min-h-screen bg-background" suppressHydrationWarning />
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 space-y-6 p-6">
          {/* Breadcrumb */}
          <div>
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
              <a href="/dashboard" className="hover:text-foreground transition-colors">Trang chủ</a>
              <span>/</span>
              <span className="text-foreground font-medium">Mã nguồn</span>
            </nav>
            <h1 className="text-xl font-bold text-foreground">Kho mã nguồn</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Khám phá và mua các mã nguồn website chất lượng cao.</p>
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm kiếm mã nguồn..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-input bg-muted/40 py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
              {isFetching && !isLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => { setCategoryId(undefined); setPage(1) }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${!categoryId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                Tất cả
              </button>
              {categories?.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => { setCategoryId(cat.id); setPage(1) }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${categoryId === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                  <Skeleton className="h-44 w-full" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                    <div className="flex gap-1.5">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.products?.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.products.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">Không tìm thấy mã nguồn nào.</p>
            </div>
          )}

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Trước
              </button>
              {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === data.pagination.totalPages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground">...</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Sau →
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

const ProductCard = memo(function ProductCard({ product }: { product: any }) {
  const hasDiscount = product.salePrice && product.discountPercentage

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      {/* Thumbnail */}
      <a href={`/source-code/${product.slug}`} className="relative block h-40 overflow-hidden bg-muted">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
        )}
        {/* Rank ribbon — top right */}
        <div className="absolute top-0 right-3 rounded-b-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground shadow-sm">
          #{product.rank}
        </div>
        {/* FREE badge */}
        {product.isFree && (
          <div className="absolute top-2 left-2 rounded bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            FREE
          </div>
        )}
      </a>

      {/* Content */}
      <div className="p-4 space-y-2.5">
        {/* Category */}
        {product.category && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            {product.category.name}
          </span>
        )}

        {/* Title */}
        <a href={`/source-code/${product.slug}`}>
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {product.title}
          </h3>
        </a>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          {product.isFree ? (
            <span className="text-base font-bold text-green-500">Miễn phí</span>
          ) : hasDiscount ? (
            <>
              <span className="text-base font-bold text-red-500">{product.salePrice.toLocaleString()}đ</span>
              <span className="text-xs text-muted-foreground line-through">{product.price.toLocaleString()}đ</span>
              <span className="text-[10px] font-bold text-red-500">-{product.discountPercentage}%</span>
            </>
          ) : (
            <span className="text-base font-bold text-red-500">{product.price.toLocaleString()}đ</span>
          )}
        </div>

        {/* Tags — green style */}
        {product.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="rounded border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Rating + Sales */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="oklch(0.75 0.15 85)" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ))}
          </div>
          <span>Đã bán {product.salesCount}</span>
        </div>

        {/* CTA Button — full width */}
        <a
          href={`/source-code/${product.slug}`}
          className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-primary py-2 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
          Xem Ngay
        </a>
      </div>
    </div>
  )
})
