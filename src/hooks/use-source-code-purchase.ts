"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"
import { useGuestGate } from "@/hooks/use-guest-gate"

interface ProductForPurchase {
  id: string
  isFree: boolean
  price: number
  salePrice: number | null
}

interface AppliedCoupon {
  code: string
  discountAmount: number
  finalAmount: number
  message: string
}

export function useSourceCodePurchase(product: ProductForPurchase | null | undefined) {
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { requireAuth } = useGuestGate()
  const [buyOpen, setBuyOpen] = useState(false)
  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)

  const basePrice = useMemo(() => {
    if (!product) return 0
    return product.isFree ? 0 : product.salePrice || product.price
  }, [product])
  const finalPrice = appliedCoupon ? appliedCoupon.finalAmount : basePrice

  const validateCouponMut = useMutation(trpc.order.validateCoupon.mutationOptions({
    onSuccess: (res) => {
      setAppliedCoupon({
        code: couponCode.trim().toUpperCase(),
        discountAmount: res.discountAmount,
        finalAmount: res.finalAmount,
        message: res.message,
      })
      toast.success(res.message)
    },
    onError: (err) => {
      setAppliedCoupon(null)
      toast.error(err.message || "Mã không hợp lệ")
    },
  }))

  const purchaseMut = useMutation(trpc.order.purchase.mutationOptions({
    onSuccess: async (res) => {
      toast.success(res.message || "Mua hàng thành công")
      closeDialog()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.dashboard.stats.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.dashboard.recentTransactions.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.dashboard.recentActivity.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.order.myOrders.queryKey() }),
      ])
      router.refresh()
      router.push("/customer/history/code")
    },
    onError: (err) => {
      const message = err.message || ""
      if (/đã mua/i.test(message)) {
        toast.error("Bạn đã mua mã nguồn này trước đó rồi")
        closeDialog()
        router.push("/customer/history/code")
        return
      }
      toast.error(message || "Mua hàng thất bại")
    },
  }))

  function closeDialog() {
    setBuyOpen(false)
    setCouponCode("")
    setAppliedCoupon(null)
  }

  function setDialogOpen(open: boolean) {
    if (open) {
      // Guest → redirect login thay vì mở dialog mua.
      if (requireAuth(() => true) !== true) return
      setBuyOpen(true)
      return
    }
    closeDialog()
  }

  function updateCouponCode(value: string) {
    setCouponCode(value)
    setAppliedCoupon(null)
  }

  function applyCoupon() {
    if (!couponCode.trim() || basePrice === 0) return
    validateCouponMut.mutate({ code: couponCode.trim(), orderAmount: basePrice })
  }

  function removeCoupon() {
    setCouponCode("")
    setAppliedCoupon(null)
  }

  function purchase() {
    if (!product) return
    purchaseMut.mutate({
      productId: product.id,
      couponCode: appliedCoupon ? couponCode.trim() : undefined,
    })
  }

  return {
    buyOpen,
    setBuyOpen: setDialogOpen,
    couponCode,
    appliedCoupon,
    basePrice,
    finalPrice,
    isValidatingCoupon: validateCouponMut.isPending,
    isPurchasing: purchaseMut.isPending,
    updateCouponCode,
    applyCoupon,
    removeCoupon,
    purchase,
  }
}
