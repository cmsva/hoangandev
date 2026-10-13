"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

export type LogoSortField = "createdAt" | "price" | "logoTitle"
export type LogoSortDir = "asc" | "desc"

/**
 * useLogoHistory — Layer 4 (Hook): controller cho trang Logo đã thuê.
 *
 * Quản lý: pagination, debounced search, status filter, sort, fetch myOrders,
 * download mutation, cancel order mutation.
 */
export function useLogoHistory() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  // ─── Form state ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<LogoSortField>("createdAt")
  const [sortDir, setSortDir] = useState<LogoSortDir>("desc")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [cancellingOrder, setCancellingOrder] = useState<any>(null)

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
    ...trpc.logo.myOrders.queryOptions({
      page,
      limit,
      search: search || undefined,
      status: (statusFilter || undefined) as any,
      sortField,
      sortDir,
    }),
    placeholderData: keepPreviousData,
  }) as { data: any; isLoading: boolean; isFetching: boolean }

  const items = data?.items || []
  const totalPages = data?.pagination?.totalPages || 1
  const total = data?.pagination?.total || 0
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)

  // ─── Mutations ───────────────────────────────────────────────────────────
  const downloadMut = useMutation({
    ...trpc.logo.getDownloadUrl.mutationOptions(),
    onSuccess: (res: any) => {
      if (res?.downloadUrl) {
        toast.success("Đã tạo link tải, mở tab mới...")
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer")
        queryClient.invalidateQueries({ queryKey: trpc.logo.myOrders.queryKey() })
      } else {
        toast.error("Không lấy được link tải")
      }
    },
    onError: (err: any) => toast.error(err?.message || "Tải file thất bại"),
  })

  const cancelMut = useMutation({
    ...trpc.logo.cancelOrder.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Đã hủy đơn")
      setCancellingOrder(null)
      queryClient.invalidateQueries({ queryKey: trpc.logo.myOrders.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.dashboard.stats.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.dashboard.recentTransactions.queryKey() })
      router.refresh()
    },
    onError: (err: any) => toast.error(err?.message || "Hủy đơn thất bại"),
  })

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleSort = useCallback((field: LogoSortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prev
      }
      setSortDir("desc")
      return field
    })
    setPage(1)
  }, [])

  const handleStatusChange = useCallback((v: string) => {
    setStatusFilter(v)
    setPage(1)
  }, [])

  const handleLimitChange = useCallback((n: number) => {
    setLimit(n)
    setPage(1)
  }, [])

  const handleDownload = useCallback(
    (orderId: string) => downloadMut.mutate({ orderId }),
    [downloadMut]
  )

  const handleConfirmCancel = useCallback(() => {
    if (cancellingOrder) cancelMut.mutate({ orderId: cancellingOrder.id })
  }, [cancellingOrder, cancelMut])

  return {
    // Data
    items,
    isLoading,
    isFetching,
    total,
    totalPages,
    startRow,
    endRow,

    // Pagination + filter
    page,
    setPage,
    limit,
    setLimit: handleLimitChange,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter: handleStatusChange,
    sortField,
    sortDir,
    toggleSort,

    // Actions
    handleDownload,
    isDownloading: downloadMut.isPending,
    downloadingId: downloadMut.variables?.orderId,

    cancellingOrder,
    setCancellingOrder,
    handleConfirmCancel,
    isCancelling: cancelMut.isPending,
  }
}
