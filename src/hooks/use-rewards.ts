"use client"

import { useState, useMemo, useCallback } from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import type { RewardLogType } from "@/models/reward-log.model"

/**
 * useRewards — Layer 4 controller cho /customer/rewards.
 */
export function useRewards() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // ─── Server queries ──────────────────────────────────────────────────────
  const summaryQuery = useQuery(trpc.rewards.summary.queryOptions())
  const configQuery = useQuery(trpc.rewards.config.queryOptions())

  // ─── History controls ────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState<RewardLogType | "all">("all")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const limit = 20

  const historyQuery = useQuery(
    trpc.rewards.history.queryOptions({
      type: typeFilter,
      search: search || undefined,
      page,
      limit,
    })
  )

  // ─── Redeem form ─────────────────────────────────────────────────────────
  const [redeemInput, setRedeemInput] = useState("")
  const redeemPoints = useMemo(() => {
    const n = parseInt(redeemInput.replace(/\D/g, "") || "0", 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [redeemInput])

  const minRedeem = configQuery.data?.redeemMinPoints ?? 0
  const rate = configQuery.data?.redeemVndPerPoint ?? 0
  const points = summaryQuery.data?.points ?? 0
  const willReceive = redeemPoints > 0 ? redeemPoints * rate : 0
  const enabled = configQuery.data?.enabled ?? true
  const canRedeem =
    enabled &&
    redeemPoints >= minRedeem &&
    redeemPoints <= points &&
    redeemPoints > 0

  // ─── Mutation: redeem ────────────────────────────────────────────────────
  const redeemMut = useMutation(
    trpc.rewards.redeem.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res.message || "Đã đổi điểm thưởng thành công")
        setRedeemInput("")
        // Refetch summary + history
        queryClient.invalidateQueries({ queryKey: trpc.rewards.summary.queryOptions().queryKey })
        queryClient.invalidateQueries({ queryKey: trpc.rewards.history.queryOptions({ type: typeFilter, page, limit }).queryKey })
      },
      onError: (err: any) => toast.error(err.message || "Đổi điểm thất bại"),
    })
  )

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleRedeem = useCallback(() => {
    if (!canRedeem || redeemPoints <= 0) return
    redeemMut.mutate({ points: redeemPoints })
  }, [canRedeem, redeemPoints, redeemMut])

  const handleSearch = useCallback(() => {
    setSearch(searchInput.trim())
    setPage(1)
  }, [searchInput])

  const handleTypeChange = useCallback((t: RewardLogType | "all") => {
    setTypeFilter(t)
    setPage(1)
  }, [])

  return {
    // Summary
    summary: summaryQuery.data,
    isLoadingSummary: summaryQuery.isLoading,

    // Config
    config: configQuery.data,
    isLoadingConfig: configQuery.isLoading,

    // History
    history: historyQuery.data,
    isLoadingHistory: historyQuery.isLoading,
    typeFilter,
    onChangeType: handleTypeChange,
    search,
    searchInput,
    setSearchInput,
    onSearchSubmit: handleSearch,
    page,
    setPage,
    limit,

    // Redeem form
    redeemInput,
    setRedeemInput,
    redeemPoints,
    willReceive,
    canRedeem,
    minRedeem,
    rate,
    enabled,
    points,
    onRedeem: handleRedeem,
    isRedeeming: redeemMut.isPending,
  }
}
