"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useTRPC } from "@/trpc/client"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { ShoppingCart } from "lucide-react"

function formatPrice(n: number | undefined | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ"
}

export function CreateLogoClient() {
  const { collapsed } = useSidebar()
  const trpc = useTRPC()

  const [page, setPage] = useState(1)
  const [limit] = useState(12)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")

  // Debounce search 300ms
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput.trim())
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput, search])

  const { data: cats = [] } = useQuery(trpc.logo.categories.queryOptions()) as { data: any[] }

  const { data, isLoading, isFetching } = useQuery({
    ...trpc.logo.list.queryOptions({
      page,
      limit,
      search: search || undefined,
      categoryId: categoryId || undefined,
      sortField: "stt",
      sortDir: "asc",
    }),
    placeholderData: keepPreviousData,
  }) as { data: any; isLoading: boolean; isFetching: boolean }

  const items = data?.items || []
  const totalPages = data?.pagination?.totalPages || 1
  const total = data?.pagination?.total || 0
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            {/* Header + breadcrumb */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
                  <span className="text-foreground font-normal">Tạo Logo</span>
                </nav>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Marketplace Logo</h1>
                <p className="text-sm text-muted-foreground">Bộ sưu tập logo chuyên nghiệp — chọn mẫu, tùy biến, tải file gốc.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/customer/history/logo"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border bg-background px-4 h-9 text-sm font-medium hover:bg-accent transition-all"
                >
                  Logo đã mua
                </Link>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg>
              <input
                type="text"
                placeholder="Tìm kiếm logo theo tên..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-transparent pl-10 pr-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
              {isFetching && !isLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
              )}
            </div>

            {/* Category tabs — match source-code style */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => { setCategoryId(""); setPage(1) }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  !categoryId
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Tất cả
              </button>
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCategoryId(c.id); setPage(1) }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    categoryId === c.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-lg border bg-card overflow-hidden">
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((logo: any) => (
                  <LogoCard key={logo.id} logo={logo} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-card p-12 text-center">
                <p className="text-muted-foreground">Không tìm thấy logo phù hợp.</p>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && total > 0 && (
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="text-sm text-muted-foreground">
                  Hiển thị {startRow}-{endRow} / {total} logo
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-all"
                  >
                    Trước
                  </button>
                  <span className="hidden sm:contents">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .map((p, idx, arr) => (
                        <span key={p}>
                          {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground text-sm">...</span>}
                          <button
                            onClick={() => setPage(p)}
                            className={`inline-flex items-center justify-center rounded-md h-8 min-w-8 px-3 text-sm font-medium transition-all ${
                              p === page
                                ? "bg-primary text-primary-foreground"
                                : "border bg-background hover:bg-accent"
                            }`}
                          >
                            {p}
                          </button>
                        </span>
                      ))}
                  </span>
                  <span className="sm:hidden text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-all"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function LogoCard({ logo }: { logo: any }) {
  const isFree = logo.price === 0
  return (
    <div className="group rounded-lg border bg-card overflow-hidden transition-all hover:shadow-md hover:border-primary/30">
      {/* Preview */}
      <div className="relative aspect-square w-full bg-muted overflow-hidden">
        {logo.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo.image}
            alt={logo.title}
            loading="lazy"
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No preview
          </div>
        )}
        {isFree && (
          <span className="absolute top-2 left-2 rounded-md bg-emerald-500 text-white px-1.5 py-0.5 text-[10px] font-bold">
            FREE
          </span>
        )}
        {logo.salesCount > 0 && (
          <span className="absolute top-2 right-2 rounded-md bg-black/60 text-white px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm">
            {logo.salesCount} đã mua
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        {logo.category && (
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">
            {logo.category.name}
          </div>
        )}
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem]" title={logo.title}>
          {logo.title}
        </h3>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className={`text-base font-bold ${isFree ? "text-emerald-600" : "text-primary"}`}>
            {isFree ? "Miễn phí" : formatPrice(logo.price)}
          </span>
        </div>
        <Link
          href={`/create-logo/${logo.slug}`}
          className="flex items-center justify-center gap-1.5 w-full rounded-md bg-primary text-primary-foreground h-9 text-sm font-medium transition-all hover:bg-primary/90"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Tạo Ngay
        </Link>
      </div>
    </div>
  )
}

