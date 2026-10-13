"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"
import { useGuestGate } from "@/hooks/use-guest-gate"

export function useLogoPurchase(logoId: string | null | undefined) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { requireAuth } = useGuestGate()
  const [shopName, setShopName] = useState("")
  const [customNote, setCustomNote] = useState("")

  const purchaseMut = useMutation({
    ...trpc.logo.purchase.mutationOptions(),
    onSuccess: async (res) => {
      toast.success(res?.message || "Đã thuê logo thành công")
      setShopName("")
      setCustomNote("")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.logo.myRentalCount.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.logo.myOrders.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.dashboard.stats.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.dashboard.recentTransactions.queryKey() }),
      ])
      router.refresh()
      setTimeout(() => router.push("/customer/history/logo"), 800)
    },
    onError: (err) => toast.error(err.message || "Thuê logo thất bại"),
  })

  function rent() {
    if (!logoId) return
    // Guest → redirect login (backend cũng chặn, đây chỉ là UX).
    if (requireAuth(() => true) !== true) return
    const trimmed = shopName.trim()
    if (trimmed.length < 2) {
      toast.error("Tên shop tối thiểu 2 ký tự")
      return
    }
    if (trimmed.length > 200) {
      toast.error("Tên shop quá dài")
      return
    }
    purchaseMut.mutate({
      logoId,
      shopName: trimmed,
      customNote: customNote.trim() || undefined,
    })
  }

  return {
    shopName,
    setShopName,
    customNote,
    setCustomNote,
    rent,
    isPurchasing: purchaseMut.isPending,
  }
}
