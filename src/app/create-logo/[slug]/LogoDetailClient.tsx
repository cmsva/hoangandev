"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { useLogoPurchase } from "@/hooks/use-logo-purchase"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ShoppingCart,
  Eye,
  Tag,
  ArrowLeft,
  Check,
  Zap,
  Shield,
  Headphones,
  RefreshCw,
} from "lucide-react"
import { sanitizeRichHtml } from "@/lib/sanitize"

function formatPrice(n: number | undefined | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ"
}

function formatDateTime(input: any) {
  if (!input) return "—"
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/**
 * Decode base64 HTML content (theo SQL gốc dữ liệu base64-encoded).
 * Nếu fail thì trả về raw text.
 */
function safeDecodeContent(content: string | null): string {
  if (!content) return ""
  // Heuristic: chỉ decode nếu trông giống base64
  const looksLikeBase64 = /^[A-Za-z0-9+/=\s]+$/.test(content) && content.length > 20
  if (!looksLikeBase64) return content
  try {
    const decoded = typeof window !== "undefined" ? atob(content.trim()) : ""
    return decoded || content
  } catch {
    return content
  }
}

const FEATURES = [
  { icon: Zap, label: "Bàn giao nhanh", desc: "Designer custom trong 24h" },
  { icon: Shield, label: "Bản quyền 100%", desc: "Sử dụng thương mại không lo" },
  { icon: RefreshCw, label: "Sửa miễn phí", desc: "Tới khi ưng ý" },
  { icon: Headphones, label: "Hỗ trợ 24/7", desc: "Chat trực tiếp với designer" },
] as const

export function LogoDetailClient() {
  const { collapsed } = useSidebar()
  const params = useParams()
  const trpc = useTRPC()
  const slug = String(params?.slug || "")

  const { data: logo, isLoading } = useQuery({
    ...trpc.logo.detail.queryOptions({ slug }),
    enabled: !!slug,
  }) as { data: any; isLoading: boolean }

  const { data: relatedItems = [] } = useQuery({
    ...trpc.logo.related.queryOptions({
      slug,
      categoryId: logo?.category?.id,
    }),
    enabled: !!slug && !!logo,
  }) as { data: any[] }

  const { data: rentalData } = useQuery({
    ...trpc.logo.myRentalCount.queryOptions({ logoId: logo?.id }),
    enabled: !!logo?.id,
  }) as { data: any }

  const rentalCount = rentalData?.count || 0
  const {
    shopName,
    setShopName,
    customNote,
    setCustomNote,
    rent: handleRent,
    isPurchasing,
  } = useLogoPurchase(logo?.id)

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
              <Link href="/create-logo" className="hover:text-foreground transition-colors">Tạo Logo</Link>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
              <span className="text-foreground font-normal line-clamp-1 max-w-[280px]">{logo?.title || "Chi tiết"}</span>
            </nav>

            {/* Back */}
            <Link
              href="/create-logo"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </Link>

            {isLoading ? (
              <DetailSkeleton />
            ) : !logo ? (
              <div className="rounded-lg border bg-card p-12 text-center">
                <p className="text-muted-foreground">Logo không tồn tại hoặc đã bị ngừng cho thuê.</p>
                <Link
                  href="/create-logo"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 h-9 text-sm font-medium hover:bg-primary/90"
                >
                  Về danh sách
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* LEFT — Preview + description */}
                <div className="lg:col-span-3 space-y-5">
                  {/* Preview */}
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <div className="aspect-[4/3] w-full bg-muted relative overflow-hidden">
                      {logo.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logo.image}
                          alt={logo.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          Không có ảnh xem trước
                        </div>
                      )}
                      {logo.price === 0 && (
                        <span className="absolute top-3 left-3 rounded-md bg-emerald-500 text-white px-2 py-0.5 text-xs font-bold">
                          MIỄN PHÍ
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Feature grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {FEATURES.map((f) => {
                      const Icon = f.icon
                      return (
                        <div
                          key={f.label}
                          className="rounded-lg border bg-card p-3 text-center space-y-1.5"
                        >
                          <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <p className="text-xs font-semibold">{f.label}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{f.desc}</p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Description từ DB */}
                  {logo.content && (
                    <div className="rounded-lg border bg-card p-5">
                      <h2 className="text-base font-semibold mb-3">Mô tả chi tiết</h2>
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>p+p]:mt-2"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(safeDecodeContent(logo.content)) }}
                      />
                    </div>
                  )}
                </div>

                {/* RIGHT — Rental form (sticky) */}
                <aside className="lg:col-span-2">
                  <div className="rounded-lg border bg-card p-5 space-y-4 lg:sticky lg:top-20">
                    {logo.category && (
                      <Link
                        href={`/create-logo?cat=${logo.category.slug}`}
                        className="inline-flex items-center gap-1.5 text-xs uppercase font-bold text-muted-foreground tracking-wider hover:text-primary transition-colors"
                      >
                        <Tag className="h-3 w-3" />
                        {logo.category.name}
                      </Link>
                    )}

                    <h1 className="text-xl font-bold tracking-tight leading-snug">
                      {logo.title}
                    </h1>

                    {/* Price */}
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-bold ${logo.price === 0 ? "text-emerald-600" : "text-primary"}`}>
                        {logo.price === 0 ? "Miễn phí" : formatPrice(logo.price)}
                      </span>
                      <span className="text-xs text-muted-foreground">/ lượt thuê</span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Đã thuê</p>
                          <p className="text-sm font-semibold">{logo.salesCount || 0}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Lượt xem</p>
                          <p className="text-sm font-semibold">{logo.view || 0}</p>
                        </div>
                      </div>
                    </div>

                    {/* User's rental count badge */}
                    {rentalCount > 0 && (
                      <div className="rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 px-3 py-2 text-xs font-medium flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5" />
                        Bạn đã thuê mẫu này <span className="font-bold">{rentalCount}</span> lần
                      </div>
                    )}

                    {/* Form */}
                    <div className="space-y-3 pt-3 border-t">
                      <div>
                        <label className="block text-sm font-medium mb-1.5" htmlFor="shopName">
                          Tên shop / website <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id="shopName"
                          type="text"
                          value={shopName}
                          onChange={(e) => setShopName(e.target.value)}
                          placeholder="VD: Shop ABC, MMOZone, ..."
                          maxLength={200}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                          disabled={isPurchasing}
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Designer sẽ custom tên này vào logo
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1.5" htmlFor="customNote">
                          Ghi chú thêm (slogan, màu, font...)
                        </label>
                        <textarea
                          id="customNote"
                          value={customNote}
                          onChange={(e) => setCustomNote(e.target.value)}
                          rows={3}
                          maxLength={1000}
                          placeholder="VD: Slogan dòng 2, màu đỏ-vàng, font đậm..."
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none"
                          disabled={isPurchasing}
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground text-right">
                          {customNote.length}/1000
                        </p>
                      </div>

                      <button
                        onClick={handleRent}
                        disabled={isPurchasing || shopName.trim().length < 2}
                        className="flex items-center justify-center gap-2 w-full rounded-md bg-primary text-primary-foreground h-11 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {isPurchasing
                          ? "Đang xử lý..."
                          : logo.price === 0
                          ? "Thanh toán & Tạo logo (Miễn phí)"
                          : `Thanh toán & Tạo logo · ${formatPrice(logo.price)}`}
                      </button>
                    </div>

                    {/* Quick benefits */}
                    <ul className="pt-3 border-t space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-start gap-1.5">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span>Bàn giao trong 24h sau thanh toán</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span>File gốc PNG/PSD chất lượng cao</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span>Sửa miễn phí cho tới khi ưng ý</span>
                      </li>
                    </ul>

                    <p className="text-[11px] text-muted-foreground pt-2 border-t">
                      Đăng ngày: {formatDateTime(logo.createdAt)}
                    </p>
                  </div>
                </aside>
              </div>
            )}

            {/* Related */}
            {relatedItems.length > 0 && (
              <section className="space-y-4 pt-4 border-t">
                <h2 className="text-lg font-bold">Logo liên quan</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {relatedItems.map((r: any) => (
                    <Link
                      key={r.id}
                      href={`/create-logo/${r.slug}`}
                      className="group rounded-lg border bg-card overflow-hidden transition-all hover:shadow-md hover:border-primary/30"
                    >
                      <div className="aspect-square w-full bg-muted overflow-hidden">
                        {r.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image} alt={r.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        ) : null}
                      </div>
                      <div className="p-3 space-y-1">
                        {r.category && (
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider truncate">
                            {r.category.name}
                          </p>
                        )}
                        <h3 className="text-sm font-semibold line-clamp-2 min-h-[2.5rem]">{r.title}</h3>
                        <p className="text-sm font-bold text-primary">
                          {r.price === 0 ? "Miễn phí" : formatPrice(r.price)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-4">
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
      <div className="lg:col-span-2 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  )
}

