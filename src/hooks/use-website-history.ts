"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

/**
 * useWebsiteHistory — Layer 4 (Hook): controller cho trang Website đã thuê.
 *
 * Quản lý: pagination, debounced search, status filter, fetch myOrders,
 * modal gia hạn (renew) + mutation service.renew.
 * View chỉ destructure + render.
 */
export function useWebsiteHistory() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  // ─── Form state ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [nsDialogOrder, setNsDialogOrder] = useState<any>(null)

  // ─── Modal state: Gia hạn ────────────────────────────────────────────────
  const [renewingOrder, setRenewingOrder] = useState<any>(null)
  const [renewMonths, setRenewMonths] = useState("1")

  // ─── Search debounce 300ms ───────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput.trim())
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput, search])

  // ─── Server query ────────────────────────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    ...trpc.service.myOrders.queryOptions({
      page,
      limit,
      search: search || undefined,
      status: (statusFilter || undefined) as any,
      sortDir: "desc",
    }),
    placeholderData: keepPreviousData,
    // Auto-refresh khi còn đơn đang provisioning (NS/deploy chạy nền).
    refetchInterval: (query: any) => {
      const items = query?.state?.data?.items || []
      const provisioning = items.some((o: any) =>
        ["pending", "cf_pending", "ns_pending", "processing", "domain_buying"].includes(o.status)
      )
      return provisioning ? 8000 : false
    },
  }) as { data: any; isLoading: boolean; isFetching: boolean }


  // ─── Derived ─────────────────────────────────────────────────────────────
  const items = data?.items || []
  const totalPages = data?.pagination?.totalPages || 1
  const total = data?.pagination?.total || 0
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)

  // ─── Computed: phí gia hạn = priceExtend × số tháng ──────────────────────
  const renewCost = useMemo(
    () => (renewingOrder ? (Number(renewingOrder.priceExtend) || 0) * parseInt(renewMonths || "1") : 0),
    [renewingOrder, renewMonths]
  )

  // ─── Mutations ───────────────────────────────────────────────────────────
  const renewMut = useMutation({
    ...trpc.service.renew.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Đã gia hạn")
      setRenewingOrder(null)
      queryClient.invalidateQueries({ queryKey: trpc.service.myOrders.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.dashboard.stats.queryKey() })
      router.refresh()
    },
    onError: (err: any) => toast.error(err?.message || "Gia hạn thất bại"),
  })

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleStatusChange = useCallback((v: string) => {
    setStatusFilter(v)
    setPage(1)
  }, [])

  const handleLimitChange = useCallback((n: number) => {
    setLimit(n)
    setPage(1)
  }, [])

  const openRenew = useCallback((order: any) => {
    setRenewingOrder(order)
    setRenewMonths("1")
  }, [])

  const handleSubmitRenew = useCallback(() => {
    if (!renewingOrder) return
    renewMut.mutate({
      orderId: renewingOrder.id,
      additionalMonths: parseInt(renewMonths || "1"),
    })
  }, [renewingOrder, renewMonths, renewMut])


  return {
    // Data
    items,
    isLoading,
    isFetching,
    total,
    totalPages,
    startRow,
    endRow,

    // State
    page,
    setPage,
    limit,
    setLimit: handleLimitChange,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter: handleStatusChange,

    // NS dialog
    nsDialogOrder,
    openNsDialog: setNsDialogOrder,
    closeNsDialog: () => setNsDialogOrder(null),

    // Renew modal
    renewingOrder,
    setRenewingOrder,
    openRenew,
    renewMonths,
    setRenewMonths,
    renewCost,
    handleSubmitRenew,
    isRenewing: renewMut.isPending,
  }
}
