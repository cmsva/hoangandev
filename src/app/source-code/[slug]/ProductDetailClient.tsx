"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { CouponField } from "@/components/common/coupon-field"
import { useSourceCodePurchase } from "@/hooks/use-source-code-purchase"
import { sanitizeRichHtml } from "@/lib/sanitize"

export function ProductDetailClient({ slug }: { slug: string }) {
  const { collapsed } = useSidebar()
  const trpc = useTRPC()
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const { data: product, isLoading } = useQuery(
    trpc.product.detail.queryOptions({ slug })
  ) as { data: any; isLoading: boolean }

  const purchase = useSourceCodePurchase(product)
  const hasDiscount = !product?.isFree && Number(product?.salePrice ?? 0) > 0 && Number(product?.salePrice ?? 0) < Number(product?.price ?? 0)
  const features = product?.description?.split("\n").filter((f: string) => f.trim()) || []
  const allImages = product ? [product.thumbnail, ...(product.images || [])].filter(Boolean) : []

  const prevImage = () => setActiveImageIndex((i) => (i === 0 ? allImages.length - 1 : i - 1))
  const nextImage = () => setActiveImageIndex((i) => (i === allImages.length - 1 ? 0 : i + 1))

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-6">
          {isLoading ? (
            <ProductDetailSkeleton />
          ) : !product ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-lg font-medium text-muted-foreground">Không tìm thấy mã nguồn.</p>
              <a href="/source-code" className="mt-3 text-sm text-primary hover:underline">← Quay lại danh sách</a>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
                <a href="/dashboard" className="hover:text-foreground transition-colors">Trang chủ</a>
                <span className="text-muted-foreground/50">/</span>
                <a href="/source-code" className="hover:text-foreground transition-colors">Mã nguồn</a>
                {product.category && (
                  <>
                    <span className="text-muted-foreground/50">/</span>
                    <span className="hover:text-foreground transition-colors">{product.category.name}</span>
                  </>
                )}
                <span className="text-muted-foreground/50">/</span>
                <span className="text-foreground font-medium line-clamp-1 max-w-[250px]">{product.title}</span>
              </nav>

              {/* Main grid — 8/4 layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* ═══ Left column (8 cols) — Gallery + Detail ═══ */}
                <div className="md:col-span-8 flex flex-col gap-6">
                  {/* Gallery */}
                  <div className="space-y-3">
                    {/* Main image with arrows */}
                    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                      <img
                        src={allImages[activeImageIndex] || "/placeholder.png"}
                        alt={product.title}
                        className="w-full h-auto min-h-[300px] max-h-[480px] object-contain"
                      />
                      {/* Prev/Next arrows */}
                      {allImages.length > 1 && (
                        <>
                          <button
                            onClick={prevImage}
                            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                          </button>
                          <button
                            onClick={nextImage}
                            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Thumbnail strip with nav arrows */}
                    {allImages.length > 1 && (
                      <div className="relative">
                        <div className="flex gap-2 overflow-x-auto pb-1 px-1">
                          {allImages.map((img: string, i: number) => (
                            <button
                              key={i}
                              onClick={() => setActiveImageIndex(i)}
                              className={`shrink-0 overflow-hidden rounded-lg border-2 transition-all ${i === activeImageIndex ? "border-primary ring-1 ring-primary/30" : "border-transparent hover:border-border"}`}
                            >
                              <img src={img} alt={`Ảnh ${i + 1}`} className="h-16 w-24 object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Detail section — below gallery */}
                  {product.detail && (
                    <div className="rounded-xl border border-border bg-card p-6">
                      <div className="flex items-center gap-3 pb-3 mb-4 border-b border-border">
                        <h2 className="text-base font-semibold">Chi tiết sản phẩm</h2>
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.detail) }} />
                    </div>
                  )}
                </div>

                {/* ═══ Right column (4 cols) — Product info sidebar ═══ */}
                <div className="md:col-span-4">
                  <div className="sticky top-6 space-y-4">
                    {/* Product info card */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
                      {/* Title */}
                      <h1 className="text-lg font-bold text-foreground leading-snug">
                        {product.title}
                      </h1>

                      {/* Price + Category row */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-sm font-medium text-muted-foreground">Giá thanh toán:</span>
                          <div className="flex flex-col items-end gap-1">
                            {product.isFree ? (
                              <span className="text-lg font-bold text-green-500">Miễn phí</span>
                            ) : hasDiscount ? (
                              <>
                                <span className="text-lg font-bold text-green-500">{product.salePrice.toLocaleString()} ₫</span>
                                <span className="text-xs text-muted-foreground">
                                  Giá gốc <span className="line-through">{product.price.toLocaleString()}đ</span>
                                </span>
                              </>
                            ) : (
                              <span className="text-lg font-bold text-green-500">{product.price.toLocaleString()} ₫</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Danh mục:</span>
                          <span className="text-sm text-foreground">{product.category?.name || "—"}</span>
                        </div>
                      </div>

                      {/* Feature checklist */}
                      {features.length > 0 && (
                        <ul className="space-y-2.5">
                          {features.map((feature: string, i: number) => (
                            <li key={i} className="flex items-center gap-2.5">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.62 0.17 145)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-sm text-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* CTA Button — Thanh Toán (luôn hiện, backend sẽ chặn nếu đã mua) */}
                      <button
                        onClick={() => purchase.setBuyOpen(true)}
                        className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                        </svg>
                        Thanh Toán
                      </button>

                      {/* Xem Demo button */}
                      {product.demoUrl && (
                        <a
                          href={product.demoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" />
                          </svg>
                          Xem Demo
                        </a>
                      )}

                      {/* Stats boxes */}
                      <div className="flex gap-3 pt-3 border-t border-border">
                        <div className="flex-1 rounded-lg border border-border p-3 text-center">
                          <p className="text-xs text-muted-foreground font-medium">Tổng lượt bán</p>
                          <p className="text-xl font-bold text-foreground mt-0.5">{product.salesCount || 0}</p>
                        </div>
                        <div className="flex-1 rounded-lg border border-border p-3 text-center">
                          <p className="text-xs text-muted-foreground font-medium">Tổng lượt xem</p>
                          <p className="text-xl font-bold text-foreground mt-0.5">{product.view || 0}</p>
                        </div>
                      </div>
                    </div>

                    {/* Tags card */}
                    {product.tags?.length > 0 && (
                      <div className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-sm font-bold mb-3">Thẻ liên quan</h2>
                        <div className="flex flex-wrap gap-1.5">
                          {product.tags.map((tag: string) => (
                            <span key={tag} className="px-2.5 py-1 bg-muted text-muted-foreground rounded text-xs cursor-pointer hover:bg-accent hover:text-foreground transition-colors">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>


            </div>
          )}
        </main>
      </div>

      {/* Purchase Confirmation Dialog */}
      {product && (
        <Dialog open={purchase.buyOpen} onOpenChange={purchase.setBuyOpen}>
          <DialogContent className="max-w-md p-0 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <DialogTitle>Xác nhận thanh toán</DialogTitle>
            </div>

            {/* Product image */}
            {product.thumbnail && (
              <div className="px-6 pb-4">
                <img
                  src={product.thumbnail}
                  alt={product.title}
                  className="w-full h-auto max-h-[220px] object-contain rounded-lg bg-muted"
                />
              </div>
            )}

            {/* Body */}
            <div className="px-6 pb-6 space-y-4">
              {/* Product title */}
              <h3 className="text-base font-bold text-foreground leading-snug">
                {product.title}
              </h3>

              {/* Coupon */}
              <CouponField
                value={purchase.couponCode}
                onChange={purchase.updateCouponCode}
                applied={purchase.appliedCoupon
                  ? { code: purchase.appliedCoupon.code, discountAmount: purchase.appliedCoupon.discountAmount }
                  : null}
                onApply={purchase.applyCoupon}
                onRemove={purchase.removeCoupon}
                validating={purchase.isValidatingCoupon}
                disabled={purchase.basePrice === 0 || purchase.isPurchasing}
              />

              {/* Total */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-base font-semibold text-foreground">Tổng tiền:</span>
                <span className="text-lg font-bold text-green-500">
                  {purchase.finalPrice === 0 ? "Miễn phí" : `${purchase.finalPrice.toLocaleString()} ₫`}
                </span>
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => purchase.setBuyOpen(false)}
                  disabled={purchase.isPurchasing}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-accent disabled:opacity-50"
                >
                  Đóng
                </button>
                <button
                  onClick={purchase.purchase}
                  disabled={purchase.isPurchasing}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {purchase.isPurchasing ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      Đang xử lý...
                    </>
                  ) : (
                    "Thanh Toán"
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}



function ProductDetailSkeleton() {
  return (
    <div className="space-y-8 max-w-6xl">
      <Skeleton className="h-4 w-72" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          <Skeleton className="h-[380px] w-full rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-20 rounded-lg shrink-0" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-8 w-40" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="space-y-2 pt-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


