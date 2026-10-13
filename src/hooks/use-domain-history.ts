"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

export type DomainSortField = "domainName" | "totalAmount" | "createdAt" | "expiredAt"
export type DomainSortDir = "asc" | "desc"

/**
 * useDomainHistory — Layer 4 (Hook): controller cho trang Tên miền đã mua.
 *
 * Quản lý: pagination, search debounce, status filter, sort, fetch myOrders,
 * edit nameserver mutation, renew mutation, modal state.
 */
export function useDomainHistory() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  // ─── Form state ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [sortField, setSortField] = useState<DomainSortField>("createdAt")
  const [sortDir, setSortDir] = useState<DomainSortDir>("desc")

  // ─── Modal state ─────────────────────────────────────────────────────────
  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [editNs1, setEditNs1] = useState("")
  const [editNs2, setEditNs2] = useState("")
  const [renewingOrder, setRenewingOrder] = useState<any>(null)

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
    ...trpc.domain.myOrders.queryOptions({
      page,
      limit,
      search: search || undefined,
      status: (statusFilter || undefined) as any,
      sortField,
      sortDir,
    }),
    placeholderData: keepPreviousData,
  }) as { data: any; isLoading: boolean; isFetching: boolean }

  const orders = data?.items || []
  const totalPages = data?.pagination?.totalPages || 1
  const total = data?.pagination?.total || 0
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)

  // ─── Mutations ───────────────────────────────────────────────────────────
  const updateNsMut = useMutation({
    ...trpc.domain.updateNameserver.mutationOptions(),
    onSuccess: () => {
      toast.success("Cập nhật nameserver thành công")
      setEditingOrder(null)
      queryClient.invalidateQueries({ queryKey: trpc.domain.myOrders.queryKey() })
    },
    onError: (err: any) => toast.error(err?.message || "Cập nhật nameserver thất bại"),
  })

  const renewMut = useMutation({
    ...trpc.domain.requestRenew.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Yêu cầu gia hạn đã gửi")
      setRenewingOrder(null)
      queryClient.invalidateQueries({ queryKey: trpc.domain.myOrders.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.dashboard.stats.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.dashboard.recentTransactions.queryKey() })
      router.refresh()
    },
    onError: (err: any) => toast.error(err?.message || "Yêu cầu gia hạn thất bại"),
  })

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleSort = useCallback((field: DomainSortField) => {
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

  const openEditNs = useCallback((order: any) => {
    setEditingOrder(order)
    setEditNs1(order.ns1 || "")
    setEditNs2(order.ns2 || "")
  }, [])

  const handleSubmitNs = useCallback(() => {
    if (!editingOrder) return
    updateNsMut.mutate({
      orderId: editingOrder.id,
      ns1: editNs1.trim(),
      ns2: editNs2.trim(),
    })
  }, [editingOrder, editNs1, editNs2, updateNsMut])

  const handleConfirmRenew = useCallback(() => {
    if (renewingOrder) renewMut.mutate({ orderId: renewingOrder.id })
  }, [renewingOrder, renewMut])

  return {
    // Data
    orders,
    isLoading,
    isFetching,
    total,
    totalPages,
    startRow,
    endRow,

    // Filter / sort
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

    // Edit NS modal
    editingOrder,
    setEditingOrder,
    openEditNs,
    editNs1,
    setEditNs1,
    editNs2,
    setEditNs2,
    handleSubmitNs,
    isSavingNs: updateNsMut.isPending,

    // Renew
    renewingOrder,
    setRenewingOrder,
    handleConfirmRenew,
    isRenewing: renewMut.isPending,
  }
}
