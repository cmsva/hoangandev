"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Skeleton } from "@/components/ui/skeleton"
import { SelectCustom } from "@/components/ui/select-custom"
import {
  ShoppingCart,
  Eye,
  Tag,
  ArrowLeft,
  Check,
  ExternalLink,
  ShieldCheck,
} from "lucide-react"
import { useServicePurchase } from "@/hooks/use-service-purchase"
import { CouponField } from "@/components/common/coupon-field"
import { ShopCredentialsField } from "@/components/common/shop-credentials-field"
import { sanitizeRichHtml } from "@/lib/sanitize"

function formatPrice(n: number | undefined | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ"
}

export function ServiceDetailClient() {
  const { collapsed } = useSidebar()
  const params = useParams()
  const slug = String(params?.slug || "")

  const purchase = useServicePurchase(slug)
  const {
    service,
    tlds,
    isLoading,
    allImages,
    currentPricing,
    selectedTld,
    breakdown,
    appliedCoupon,
    selectedDuration: _sd,
    setSelectedDuration,
    domainName,
    setDomainName,
    domainNew,
    domainTldId,
    setDomainTldId,
    shopAccount,
    setShopAccount,
    shopPassword,
    setShopPassword,
    showPassword,
    setShowPassword,
    activeImage,
    setActiveImage,
    couponInput,
    setCouponInput,
    handleDomainModeChange,
    handleApplyCoupon,
    handleRemoveCoupon,
    handleSubmit,
    isPurchasing,
    isValidatingCoupon,
  } = purchase

  const isAutoDeploy = service?.deployMode === "auto"

  const tldOptions = [
    { value: "", label: "Chọn loại miền..." },
    ...tlds.map((t) => ({
      value: t.id,
      label: `.${t.tld} (+${formatPrice(t.priceSold)})`,
    })),
  ]

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
              <Chevron />
              <Link href="/create-website" className="hover:text-foreground transition-colors">Tạo Website</Link>
              <Chevron />
              <span className="text-foreground font-normal line-clamp-1 max-w-[280px]">{service?.serviceName || "Chi tiết"}</span>
            </nav>

            <Link href="/create-website" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </Link>

            {isLoading ? (
              <DetailSkeleton />
            ) : !service ? (
              <EmptyService />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                {/* LEFT — Preview & description */}
                <div className="lg:col-span-4 space-y-5">
                  <PreviewCarousel
                    images={allImages}
                    activeIndex={activeImage}
                    onSelect={setActiveImage}
                    alt={service.serviceName}
                  />

                  <DemoButtons demoUrl={service.demoUrl} adminDemoUrl={service.adminDemoUrl} />



                  {service.featuresList?.length > 0 && (
                    <FeaturesListSection features={service.featuresList} />
                  )}

                  {service.description && <DescriptionSection html={service.description} />}
                </div>

                {/* RIGHT — Order form (sticky) */}
                <aside className="lg:col-span-3">
                  <div className="rounded-lg border bg-card p-5 space-y-4 lg:sticky lg:top-20">
                    {service.category && <CategoryTag name={service.category.name} />}
                    <h1 className="text-xl font-bold tracking-tight leading-snug">{service.serviceName}</h1>

                    <Stats salesCount={service.salesCount} view={service.view} />

                    <DurationPicker
                      pricings={service.pricings}
                      currentDuration={currentPricing?.durationMonths || 0}
                      onSelect={setSelectedDuration}
                    />

                    {/* Form */}
                    <div className="space-y-3 pt-3 border-t">
                      <DomainField
                        domainName={domainName}
                        onDomainNameChange={setDomainName}
                        domainNew={domainNew}
                        onModeChange={handleDomainModeChange}
                        tldId={domainTldId}
                        onTldChange={setDomainTldId}
                        tldOptions={tldOptions}
                        selectedTld={selectedTld?.tld}
                        disabled={isPurchasing}
                      />

                      {isAutoDeploy && service.fixedNameservers.length >= 2 && (
                        <FixedNsNotice nameservers={service.fixedNameservers} />
                      )}

                      <ShopCredentialsField
                        account={shopAccount}
                        onAccountChange={setShopAccount}
                        password={shopPassword}
                        onPasswordChange={setShopPassword}
                        showPassword={showPassword}
                        onToggleShowPassword={() => setShowPassword(!showPassword)}
                        disabled={isPurchasing}
                      />

                      <CouponField
                        value={couponInput}
                        onChange={setCouponInput}
                        applied={appliedCoupon}
                        onApply={handleApplyCoupon}
                        onRemove={handleRemoveCoupon}
                        validating={isValidatingCoupon}
                        disabled={isPurchasing}
                      />
                    </div>

                    <PriceSummary
                      breakdown={breakdown}
                      tldName={selectedTld?.tld}
                      couponPercent={appliedCoupon?.discount}
                    />

                    <button
                      onClick={handleSubmit}
                      disabled={isPurchasing || !breakdown.finalTotal}
                      className="flex items-center justify-center gap-2 w-full rounded-md bg-primary text-primary-foreground h-11 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {isPurchasing ? "Đang xử lý..." : `Xác Nhận Thuê · ${formatPrice(breakdown.finalTotal)}`}
                    </button>


                  </div>
                </aside>
              </div>
            )}
          </div>
        </main>
      </div>


    </div>
  )
}

// ─── Sub-components (pure presentational) ─────────────────────────────────────

function Chevron() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function EmptyService() {
  return (
    <div className="rounded-lg border bg-card p-12 text-center">
      <p className="text-muted-foreground">Mẫu website không tồn tại hoặc đã ngưng.</p>
      <Link href="/create-website" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 h-9 text-sm font-medium hover:bg-primary/90">
        Về danh sách
      </Link>
    </div>
  )
}

function PreviewCarousel({
  images,
  activeIndex,
  onSelect,
  alt,
}: {
  images: string[]
  activeIndex: number
  onSelect: (i: number) => void
  alt: string
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="aspect-[16/10] w-full bg-muted relative overflow-hidden">
        {images[activeIndex] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[activeIndex]} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Không có ảnh xem trước
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3 border-t scrollbar-thin">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`shrink-0 h-16 w-24 rounded-md overflow-hidden border-2 transition-all ${
                i === activeIndex
                  ? "border-primary"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DemoButtons({ demoUrl, adminDemoUrl }: { demoUrl: string | null; adminDemoUrl: string | null }) {
  if (!demoUrl && !adminDemoUrl) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {demoUrl && (
        <a href={demoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-md border bg-card hover:bg-accent h-10 text-sm font-medium transition-all">
          <ExternalLink className="h-4 w-4" />
          Xem Demo Trang
        </a>
      )}
      {adminDemoUrl && (
        <a href={adminDemoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/50 bg-primary/5 text-primary hover:bg-primary/10 h-10 text-sm font-medium transition-all">
          <ShieldCheck className="h-4 w-4" />
          Demo Admin
        </a>
      )}
    </div>
  )
}

function FeaturesListSection({ features }: { features: string[] }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold mb-3">Tính năng nổi bật</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DescriptionSection({ html }: { html: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold mb-3">Mô tả chi tiết</h2>
      <div
        className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>p+p]:mt-2"
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
      />
    </div>
  )
}

function CategoryTag({ name }: { name: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs uppercase font-bold text-muted-foreground tracking-wider">
      <Tag className="h-3 w-3" />
      {name}
    </div>
  )
}

function Stats({ salesCount, view }: { salesCount: number; view: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">Đã thuê</p>
          <p className="text-sm font-semibold">{salesCount || 0}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">Lượt xem</p>
          <p className="text-sm font-semibold">{view || 0}</p>
        </div>
      </div>
    </div>
  )
}

function DurationPicker({
  pricings,
  currentDuration,
  onSelect,
}: {
  pricings: { durationMonths: number; pricePerMonth: number }[]
  currentDuration: number
  onSelect: (n: number) => void
}) {
  return (
    <div className="space-y-2 pt-3 border-t">
      <label className="block text-sm font-medium">Chọn gói thời hạn</label>
      <p className="text-[11px] text-muted-foreground">
        Giá dưới đây là <span className="font-semibold text-foreground">phí khởi tạo</span> — thanh toán 1 lần cho cả gói.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {pricings.map((p) => {
          const isActive = currentDuration === p.durationMonths
          const total = p.pricePerMonth * p.durationMonths
          return (
            <button
              key={p.durationMonths}
              onClick={() => onSelect(p.durationMonths)}
              className={`rounded-md border p-2.5 text-left transition-all ${
                isActive
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-input hover:border-primary/50"
              }`}
            >
              <div className="text-xs font-bold">{p.durationMonths} tháng</div>
              <div className={`text-sm font-semibold ${isActive ? "text-primary" : ""}`}>
                {formatPrice(total)}
              </div>
              <div className="text-[10px] font-normal text-muted-foreground">
                ({formatPrice(p.pricePerMonth)}/tháng)
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FixedNsNotice({ nameservers }: { nameservers: string[] }) {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-foreground">Vui lòng trỏ tên miền về nameserver bên dưới trước khi đặt</p>
          <div className="grid gap-1.5">
            {nameservers.slice(0, 2).map((ns) => (
              <code key={ns} className="rounded-md border bg-background/80 px-2.5 py-1.5 font-mono text-xs text-foreground">
                {ns}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DomainField({
  domainName,
  onDomainNameChange,
  domainNew,
  onModeChange,
  tldId,
  onTldChange,
  tldOptions,
  selectedTld,
  disabled,
}: {
  domainName: string
  onDomainNameChange: (v: string) => void
  domainNew: boolean
  onModeChange: (b: boolean) => void
  tldId: string
  onTldChange: (v: string) => void
  tldOptions: { value: string; label: string }[]
  selectedTld: string | undefined
  disabled: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        Tên miền <span className="text-rose-500">*</span>
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={domainName}
          onChange={(e) => onDomainNameChange(e.target.value)}
          placeholder="VD: example.com"
          maxLength={253}
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          disabled={disabled}
        />
        {domainNew && (
          <SelectCustom
            value={tldId}
            onValueChange={onTldChange}
            className="w-[180px]"
            placeholder="Loại miền"
            options={tldOptions}
          />
        )}
      </div>
      <div className="mt-2 flex gap-3 text-xs">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="radio" checked={!domainNew} onChange={() => onModeChange(false)} disabled={disabled} className="accent-primary" />
          <span>Đã có tên miền</span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="radio" checked={domainNew} onChange={() => onModeChange(true)} disabled={disabled} className="accent-primary" />
          <span>Mua tên miền mới</span>
        </label>
      </div>
      {domainNew && selectedTld && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Tên miền phải kết thúc bằng <span className="font-mono font-bold">.{selectedTld}</span>
        </p>
      )}
    </div>
  )
}

function PriceSummary({
  breakdown,
  tldName,
  couponPercent,
}: {
  breakdown: ReturnType<typeof useServicePurchase>["breakdown"]
  tldName?: string
  couponPercent?: number
}) {
  return (
    <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Phí khởi tạo website</span>
        <span>{formatPrice(breakdown.websiteAmount)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Số tháng</span>
        <span>{breakdown.duration} tháng</span>
      </div>
      {breakdown.domainTldPrice > 0 && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Domain .{tldName}</span>
          <span>+{formatPrice(breakdown.domainTldPrice)}</span>
        </div>
      )}
      {breakdown.discountAmount > 0 && (
        <div className="flex justify-between text-xs text-emerald-600">
          <span>Giảm giá ({couponPercent}%)</span>
          <span>−{formatPrice(breakdown.discountAmount)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold pt-1.5 border-t text-base">
        <span>Tổng phí khởi tạo</span>
        <span className="text-primary">{formatPrice(breakdown.finalTotal)}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight pt-0.5">
        Thanh toán 1 lần khi tạo website.
      </p>
      {breakdown.priceExtend > 0 && (
        <div className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/[0.08] p-2.5">
          <div className="flex justify-between text-xs font-semibold text-amber-700 dark:text-amber-400">
            <span>Phí gia hạn hàng tháng</span>
            <span>{formatPrice(breakdown.priceExtend)} / tháng</span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
            Áp dụng từ kỳ sau để duy trì website — KHÔNG thu ngay bây giờ.
          </p>
        </div>
      )}
    </div>
  )
}



function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
      <div className="lg:col-span-4 space-y-4">
        <Skeleton className="aspect-[16/10] w-full rounded-lg" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
      <div className="lg:col-span-3 space-y-3">
        <Skeleton className="h-7 w-full" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  )
}

