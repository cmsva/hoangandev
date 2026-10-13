"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

const TELCOS_VISIBLE = 6

/**
 * useCard — Layer 4 (Hook): controller cho trang Nạp thẻ cào.
 *
 * Quản lý:
 *  - Server queries: settings, telcos, amounts (per selected telco), history
 *  - Form state: telco/amount/serial/pin, showAllTelcos
 *  - Computed: actualAmount (sau phí), totalFee%, canSubmit
 *  - Mutations: submitCard
 *  - History: search + status filter + sort + paginate (pattern same as deposit)
 *
 * View KHÔNG có business logic. Tham khảo postman API spec ở
 *  service.submitCard + processCardCallback (callback từ partner).
 */
export function useCard() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // ─── Server queries ──────────────────────────────────────────────────────
  const settingsQuery = useQuery(trpc.card.getSettings.queryOptions()) as { data: any; isLoading: boolean }
  const telcosQuery = useQuery(trpc.card.getTelcos.queryOptions()) as { data: any[]; isLoading: boolean }
  const historyQuery = useQuery({
    ...trpc.card.getHistory.queryOptions(),
    // Khi còn thẻ "pending", poll lại mỗi 5s để cập nhật trạng thái từ callback
    // (completed/error) mà không cần khách F5. Dừng poll khi không còn pending.
    refetchInterval: (query: any) => {
      const rows = (query.state.data as any[]) || []
      const hasPending = rows.some((r) => r.status === "pending")
      return hasPending ? 5000 : false
    },
  }) as { data: any[]; isLoading: boolean; refetch: () => void }

  // ─── Form state ──────────────────────────────────────────────────────────
  const [selectedTelco, setSelectedTelco] = useState("")
  const [selectedAmount, setSelectedAmount] = useState<number>(0)
  const [serial, setSerial] = useState("")
  const [pin, setPin] = useState("")
  const [showAllTelcos, setShowAllTelcos] = useState(false)

  // ─── History UI state ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")

  // ─── Amounts query (depends on selectedTelco) ────────────────────────────
  const amountsQuery = useQuery({
    ...trpc.card.getAmounts.queryOptions({ telco: selectedTelco }),
    enabled: !!selectedTelco,
  }) as { data: any[]; isLoading: boolean }

  const telcos = telcosQuery.data || []
  const amounts = amountsQuery.data || []

  // ─── Auto-select first telco ──────────────────────────────────────────────
  useEffect(() => {
    if (telcos.length > 0 && !selectedTelco) {
      setSelectedTelco(telcos[0].name)
    }
  }, [telcos, selectedTelco])

  // ─── Computed: visible telcos (collapse > 6) ─────────────────────────────
  const visibleTelcos = useMemo(
    () => (showAllTelcos ? telcos : telcos.slice(0, TELCOS_VISIBLE)),
    [showAllTelcos, telcos]
  )
  const hasMoreTelcos = telcos.length > TELCOS_VISIBLE

  // ─── Settings & pricing ──────────────────────────────────────────────────
  const cardCk = settingsQuery.data?.cardCk ?? 0
  const cardNotice = settingsQuery.data?.cardNotice ?? ""
  const cardEnabled = settingsQuery.data?.cardStatus !== false

  const selectedAmountInfo = useMemo(
    () => amounts.find((a: any) => a.value === selectedAmount) || null,
    [amounts, selectedAmount]
  )

  /**
   * actualAmount = mệnh giá - apiFee% - cardCk%
   * Tham chiếu logic từ processCardCallback (status 1 = success).
   */
  const actualAmount = useMemo(() => {
    if (!selectedAmount || !selectedAmountInfo) return 0
    const apiFee = Math.floor((selectedAmount * (selectedAmountInfo.apiFee || 0)) / 100)
    const adminFee = Math.floor((selectedAmount * cardCk) / 100)
    return Math.max(0, selectedAmount - apiFee - adminFee)
  }, [selectedAmount, selectedAmountInfo, cardCk])

  const totalFeePercent = selectedAmountInfo?.totalFee ?? 0

  const canSubmit = useMemo(
    () =>
      cardEnabled &&
      !!selectedTelco &&
      selectedAmount > 0 &&
      serial.trim().length > 0 &&
      pin.trim().length > 0,
    [cardEnabled, selectedTelco, selectedAmount, serial, pin]
  )

  // ─── Filtered history (search) ──────────────────────────────────────────
  const allHistory = (historyQuery.data || []) as any[]
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return allHistory
    const q = searchQuery.toLowerCase()
    return allHistory.filter(
      (h) =>
        h.transId?.toLowerCase().includes(q) ||
        h.serial?.toLowerCase().includes(q) ||
        h.telco?.toLowerCase().includes(q)
    )
  }, [allHistory, searchQuery])

  // ─── Mutations ───────────────────────────────────────────────────────────
  const submitMut = useMutation(
    trpc.card.submit.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res?.message || "Thẻ đang được xử lý")
        setSerial("")
        setPin("")
        setSelectedAmount(0)
        // Refetch sau 1.5s để có data fresh từ callback (nếu nhanh)
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: trpc.card.getHistory.queryKey() })
        }, 1500)
      },
      onError: (err: any) => toast.error(err?.message || "Có lỗi xảy ra"),
    })
  )

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleSelectTelco = useCallback((telco: string) => {
    setSelectedTelco(telco)
    setSelectedAmount(0)
  }, [])

  const submitCard = useCallback(() => {
    if (!canSubmit) return
    submitMut.mutate({
      telco: selectedTelco,
      amount: selectedAmount,
      serial: serial.trim(),
      pin: pin.trim(),
    })
  }, [canSubmit, selectedTelco, selectedAmount, serial, pin, submitMut])

  return {
    // ── Loading ──
    isLoading: settingsQuery.isLoading || telcosQuery.isLoading,
    isLoadingAmounts: amountsQuery.isLoading,
    isLoadingHistory: historyQuery.isLoading,
    isLoadingTelcos: telcosQuery.isLoading,

    // ── Settings ──
    cardEnabled,
    cardNotice,
    cardCk,

    // ── Telcos ──
    telcos,
    visibleTelcos,
    hasMoreTelcos,
    showAllTelcos,
    setShowAllTelcos,
    selectedTelco,
    handleSelectTelco,

    // ── Amounts ──
    amounts,
    selectedAmount,
    setSelectedAmount,
    selectedAmountInfo,
    actualAmount,
    totalFeePercent,

    // ── Form ──
    serial,
    setSerial,
    pin,
    setPin,
    canSubmit,

    // ── History ──
    cards: allHistory,
    filteredCards: filteredHistory,
    searchQuery,
    setSearchQuery,

    // ── Actions ──
    submitCard,
    isSubmitting: submitMut.isPending,
  }
}
