"use client"

import { useEffect, useState } from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, keepPreviousData } from "@tanstack/react-query"

/**
 * useActivityLogs — Layer 4 (Hook): controller cho trang Nhật ký hoạt động.
 */
export function useActivityLogs() {
  const trpc = useTRPC()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput.trim())
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput, search])

  const { data, isLoading, isFetching } = useQuery({
    ...trpc.dashboard.myLogs.queryOptions({ page, limit, search: search || undefined }),
    placeholderData: keepPreviousData,
  }) as { data: any; isLoading: boolean; isFetching: boolean }

  const items = data?.items || []
  const total = data?.pagination?.total || 0
  const totalPages = data?.pagination?.totalPages || 1
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)

  return {
    items, isLoading, isFetching, total, totalPages, startRow, endRow,
    page, setPage, limit, setLimit, searchInput, setSearchInput,
  }
}
