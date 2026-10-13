/**
 * Hook quản lý logic form thuê website (controller phía client).
 *
 * Tách khỏi page.tsx để:
 *  - View chỉ render UI
 *  - Logic test được độc lập
 *  - Dễ debug khi có bug ở pricing/coupon
 *
 * Trả về toàn bộ state + handlers + computed values cho component.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"
import { useGuestGate } from "@/hooks/use-guest-gate"

// ─── Types ──────────────────────────────────────────────────────────────────
export interface PricingTier {
  durationMonths: number
  pricePerMonth: number
  priceExtendPerMonth: number
  totalPrice: number
}

export interface ServiceDetail {
  id: string
  serviceName: string
  slug: string
  image: string | null
  listImage: string[]
  description: string | null
  demoUrl: string | null
  adminDemoUrl: string | null
  featuresList: string[]
  salesCount: number
  view: number
  category: { id: string; name: string; slug: string } | null
  deployMode?: "manual" | "auto"
  fixedNameservers: string[]
  pricings: PricingTier[]
}

export interface TldOption {
  id: string
  tld: string
  priceSold: number
  renewSold: number
}

export interface AppliedCoupon {
  code: string
  discount: number // %
  discountAmount: number // VNĐ snapshot tại thời điểm áp
}

export interface PriceBreakdown {
  websiteAmount: number
  domainTldPrice: number
  subtotal: number
  discountAmount: number
  finalTotal: number
  pricePerMonth: number
  priceExtend: number
  duration: number
}

export interface DeployNsState {
  domainName: string
  status: string
  nameServers: string[]
  deployCompletedAt?: string | Date | null
}

// ─── Hook chính ─────────────────────────────────────────────────────────────
export function useServicePurchase(slug: string) {
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { requireAuth } = useGuestGate()

  // ─── Form state ──────────────────────────────────────────────────────────
  const [selectedDuration, setSelectedDuration] = useState<number>(0)
  const [domainName, setDomainName] = useState("")
  const [domainNew, setDomainNew] = useState(false)
  const [domainTldId, setDomainTldId] = useState<string>("")
  const [shopAccount, setShopAccount] = useState("")
  const [shopPassword, setShopPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [couponInput, setCouponInput] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
  const [nsDialog, setNsDialog] = useState<DeployNsState | null>(null)

  // ─── Server queries ──────────────────────────────────────────────────────
  const detailQuery = useQuery({
    ...trpc.service.detail.queryOptions({ slug }),
    enabled: !!slug,
  }) as { data: ServiceDetail | null | undefined; isLoading: boolean }

  const tldsQuery = useQuery({
    ...trpc.service.tlds.queryOptions(),
    enabled: domainNew,
  }) as { data: TldOption[] | undefined }

  const service = detailQuery.data ?? null
  const tlds = tldsQuery.data ?? []

  // ─── Computed: pricing & breakdown ───────────────────────────────────────
  const pricings = service?.pricings || []
  const currentPricing = useMemo(
    () =>
      pricings.find((p) => p.durationMonths === selectedDuration) || pricings[0] || null,
    [pricings, selectedDuration]
  )

  const selectedTld = useMemo(
    () => tlds.find((t) => t.id === domainTldId) || null,
    [tlds, domainTldId]
  )

  const breakdown: PriceBreakdown = useMemo(() => {
    const websiteAmount = currentPricing?.totalPrice || 0
    const domainTldPrice = domainNew && selectedTld ? selectedTld.priceSold : 0
    const subtotal = websiteAmount + domainTldPrice
    const discountAmount = appliedCoupon
      ? Math.round((subtotal * appliedCoupon.discount) / 100)
      : 0
    const finalTotal = Math.max(0, subtotal - discountAmount)
    return {
      websiteAmount,
      domainTldPrice,
      subtotal,
      discountAmount,
      finalTotal,
      pricePerMonth: currentPricing?.pricePerMonth || 0,
      priceExtend: currentPricing?.priceExtendPerMonth || 0,
      duration: currentPricing?.durationMonths || 0,
    }
  }, [currentPricing, domainNew, selectedTld, appliedCoupon])

  // ─── Auto-recalc coupon discount khi subtotal thay đổi ──────────────────
  useEffect(() => {
    if (!appliedCoupon) return
    const newDiscount = Math.round((breakdown.subtotal * appliedCoupon.discount) / 100)
    if (newDiscount !== appliedCoupon.discountAmount) {
      setAppliedCoupon((prev) => (prev ? { ...prev, discountAmount: newDiscount } : null))
    }
  }, [breakdown.subtotal, appliedCoupon])

  // ─── All images cho carousel ─────────────────────────────────────────────
  const allImages = useMemo(
    () => (service ? [service.image, ...(service.listImage || [])].filter(Boolean) : []),
    [service]
  ) as string[]

  // ─── Mutations ───────────────────────────────────────────────────────────
  const validateCouponMut = useMutation({
    ...trpc.service.validateCoupon.mutationOptions(),
    onSuccess: (res: any) => {
      setAppliedCoupon({
        code: res.code,
        discount: res.discount,
        discountAmount: res.discountAmount,
      })
      toast.success(res.message || "Áp mã thành công")
    },
    onError: (err: any) => {
      setAppliedCoupon(null)
      toast.error(err?.message || "Mã không hợp lệ")
    },
  })

  const purchaseMut = useMutation({
    ...trpc.service.purchase.mutationOptions(),
    onSuccess: async (res: any) => {
      toast.success(res?.message || "Đã đặt website")
      resetForm()
      queryClient.invalidateQueries({ queryKey: trpc.service.myOrders.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.dashboard.stats.queryKey() })
      queryClient.invalidateQueries({
        queryKey: trpc.dashboard.recentTransactions.queryKey(),
      })
      // Session resolved server-side → refresh layout để cập nhật balance trong header
      router.refresh()

      // Flow mới: user đã tự trỏ NS cố định trước. Đơn được lưu vào hàng đợi,
      // cron chỉ tạo website/DB/source, không poll/validate NS ở UI nữa.
      setTimeout(() => router.push("/customer/history/website"), 800)
    },
    onError: (err: any) => toast.error(err?.message || "Đặt thất bại"),
  })

  /**
   * Legacy helper giữ lại cho history dialog cũ nếu cần; flow mua mới không gọi nữa.
   */
  async function pollDeployInfo(orderId: string): Promise<DeployNsState> {
    let last: DeployNsState = { domainName: domainName.trim().toLowerCase(), status: "cf_pending", nameServers: [] }
    for (let i = 0; i < 6; i++) {
      try {
        const info: any = await queryClient.fetchQuery(
          trpc.service.deployInfo.queryOptions({ orderId })
        )
        last = {
          domainName: info.domain || last.domainName,
          status: info.status || last.status,
          nameServers: info.nameservers || [],
          deployCompletedAt: info.deployCompletedAt ?? null,
        }
        if (last.nameServers.length > 0) return last
      } catch {
        // ignore — retry
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
    return last
  }

  function closeNsDialog() {
    setNsDialog(null)
    router.push("/customer/history/website")
  }

  // ─── Handlers ────────────────────────────────────────────────────────────
  function resetForm() {
    setShopAccount("")
    setShopPassword("")
    setDomainName("")
    setAppliedCoupon(null)
    setCouponInput("")
  }

  function handleDomainModeChange(newMode: boolean) {
    setDomainNew(newMode)
    if (!newMode) setDomainTldId("")
  }

  function handleApplyCoupon() {
    const code = couponInput.trim().toUpperCase()
    if (!code) return toast.error("Nhập mã giảm giá")
    if (breakdown.subtotal <= 0) return toast.error("Chưa có đơn để áp mã")
    validateCouponMut.mutate({ code, orderAmount: breakdown.subtotal })
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null)
    setCouponInput("")
  }

  /**
   * Validate form và submit purchase.
   * Trả về true nếu đã trigger mutation, false nếu validation fail.
   */
  function handleSubmit(): boolean {
    if (!service?.id) return false
    // Guest → redirect login (backend cũng chặn, đây chỉ là UX).
    if (requireAuth(() => true) !== true) return false
    if (!domainName.trim()) {
      toast.error("Nhập tên miền")
      return false
    }
    if (domainNew && !domainTldId) {
      toast.error("Chọn loại miền")
      return false
    }
    if (!shopAccount.trim()) {
      toast.error("Nhập tài khoản admin")
      return false
    }
    if (!shopPassword) {
      toast.error("Nhập mật khẩu admin")
      return false
    }
    if (!breakdown.duration) {
      toast.error("Chọn gói thời hạn")
      return false
    }
    purchaseMut.mutate({
      serviceId: service.id,
      durationMonths: breakdown.duration,
      domainName: domainName.trim().toLowerCase(),
      domainNew,
      domainTldId: domainNew ? domainTldId : undefined,
      shopAccount: shopAccount.trim(),
      shopPassword,
      couponCode: appliedCoupon?.code,
    })
    return true
  }

  // ─── Public API ──────────────────────────────────────────────────────────
  return {
    // Data
    service,
    tlds,
    isLoading: detailQuery.isLoading,
    allImages,
    currentPricing,
    selectedTld,
    breakdown,
    appliedCoupon,

    // Form state
    selectedDuration,
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

    // Handlers
    handleDomainModeChange,
    handleApplyCoupon,
    handleRemoveCoupon,
    handleSubmit,

    // NS dialog (auto-deploy)
    nsDialog,
    closeNsDialog,

    // Status
    isPurchasing: purchaseMut.isPending,
    isValidatingCoupon: validateCouponMut.isPending,
  }
}
