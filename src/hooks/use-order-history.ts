"use client"

import { useEffect, useState, useCallback } from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

type SortField = "productTitle" | "totalPrice" | "orderDate"
type SortDir = "asc" | "desc"

/**
 * useOrderHistory — Layer 4 (Hook): controller cho trang Mã nguồn đã mua.
 *
 * Quản lý: pagination, search debounce, sort, fetch orders, download mutation.
 */
export function useOrderHistory() {
  const trpc = useTRPC()

  // ─── Form state ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("orderDate")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

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
    ...trpc.order.myOrders.queryOptions({
      page,
      limit,
      search: search || undefined,
      sortField,
      sortDir,
    }),
    placeholderData: keepPreviousData,
  }) as { data: any; isLoading: boolean; isFetching: boolean }

  // ─── Download mutation ───────────────────────────────────────────────────
  const downloadMut = useMutation(
    trpc.order.getDownloadUrl.mutationOptions({
      onSuccess: (res: any) => {
        if (res?.fileUrl) window.open(res.fileUrl, "_blank", "noopener,noreferrer")
        else toast.error("Không lấy được link tải")
      },
      onError: (err: any) => toast.error(err.message || "Tải về thất bại"),
    })
  )

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleSort = useCallback((field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prevField
      }
      setSortDir("desc")
      return field
    })
    setPage(1)
  }, [])

  const handleDownload = useCallback(
    (orderId: string) => downloadMut.mutate({ orderId }),
    [downloadMut]
  )

  // ─── Derived ─────────────────────────────────────────────────────────────
  const orders = data?.orders || []
  const totalPages = data?.pagination?.totalPages || 1
  const total = data?.pagination?.total || 0
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)

  return {
    // Data
    orders,
    isLoading,
    isFetching,
    total,
    totalPages,
    startRow,
    endRow,

    // Pagination
    page,
    setPage,
    limit,
    setLimit,

    // Search
    searchInput,
    setSearchInput,

    // Sort
    sortField,
    sortDir,
    toggleSort,

    // Actions
    handleDownload,
    isDownloading: downloadMut.isPending,
    downloadingId: downloadMut.variables?.orderId,
  }
}
