"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

/**
 * useAffiliate — Layer 4 (Hook): controller cho 3 page affiliate.
 *
 * Tách thành 3 hook nhỏ cho từng page:
 *  - useAffiliateOverview: stats + ref link + history snippet
 *  - useAffiliateHistory: full commission history với search + paginate
 *  - useAffiliateWithdraw: form rút tiền + history rút tiền
 */

// ─── Overview hook (cho page /customer/affiliate) ───────────────────────────

export function useAffiliateOverview() {
  const trpc = useTRPC()

  const statsQuery = useQuery(trpc.affiliate.getStats.queryOptions()) as {
    data: any
    isLoading: boolean
  }

  // ─── Ref link ────────────────────────────────────────────────────────────
  const [origin, setOrigin] = useState("")
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin)
  }, [])

  const refLink = useMemo(() => {
    const userId = statsQuery.data?.userId
    if (!origin || !userId) return ""
    return `${origin}/reffer?aff=${userId}`
  }, [origin, statsQuery.data?.userId])

  const [copied, setCopied] = useState(false)
  const copyRefLink = useCallback(() => {
    if (!refLink) return
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    navigator.clipboard.writeText(refLink).then(
      () => {
        setCopied(true)
        toast.success("Đã sao chép liên kết giới thiệu")
        setTimeout(() => setCopied(false), 2000)
      },
      () => toast.error("Không thể sao chép")
    )
  }, [refLink])

  return {
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    refLink,
    copied,
    copyRefLink,
  }
}

// ─── History hook (cho page /customer/history/affiliate) ───────────────────

export function useAffiliateHistory() {
  const trpc = useTRPC()

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // Debounce search 300ms
  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = searchInput.trim()
      if (trimmed !== search) {
        setSearch(trimmed)
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput, search])

  const historyQuery = useQuery(
    trpc.affiliate.getHistory.queryOptions({
      page,
      limit,
      search: search || undefined,
    })
  ) as { data: any; isLoading: boolean }

  const data = historyQuery.data
  const items = (data?.items || []) as any[]
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)

  const handleLimitChange = useCallback((n: number) => {
    setLimit(n)
    setPage(1)
  }, [])

  return {
    items,
    isLoading: historyQuery.isLoading,
    total,
    totalPages,
    startRow,
    endRow,
    page,
    setPage,
    limit,
    setLimit: handleLimitChange,
    searchInput,
    setSearchInput,
  }
}

// ─── Withdraw hook (cho page /customer/withdraw/affiliate) ─────────────────

type WithdrawMethod = "balance" | "bank"

interface VietQRBank {
  id: number
  name: string
  code: string
  bin: string
  shortName: string
  logo: string
  transferSupported: number
}

export function useAffiliateWithdraw() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // ─── Server queries ──────────────────────────────────────────────────────
  const configQuery = useQuery(trpc.affiliate.getConfig.queryOptions()) as {
    data: any
    isLoading: boolean
  }
  const statsQuery = useQuery(trpc.affiliate.getStats.queryOptions()) as {
    data: any
    isLoading: boolean
  }

  // ─── History query state ─────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = searchInput.trim()
      if (trimmed !== search) {
        setSearch(trimmed)
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput, search])

  const historyQuery = useQuery(
    trpc.affiliate.getWithdrawHistory.queryOptions({
      page,
      limit,
      search: search || undefined,
    })
  ) as { data: any; isLoading: boolean }

  // ─── Form state ──────────────────────────────────────────────────────────
  const [method, setMethod] = useState<WithdrawMethod>("balance")
  const [amountInput, setAmountInput] = useState("")
  const [bankCode, setBankCode] = useState("")
  const [stk, setStk] = useState("")
  const [accountName, setAccountName] = useState("")

  const parsedAmount = useMemo(
    () => parseInt(amountInput.replace(/\D/g, "") || "0", 10),
    [amountInput]
  )

  // ─── Banks list từ VietQR (load 1 lần) ───────────────────────────────────
  const [banks, setBanks] = useState<VietQRBank[]>([])
  useEffect(() => {
    let alive = true
    fetch("https://api.vietqr.io/v2/banks")
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return
        if (data?.data) {
          setBanks(
            (data.data as VietQRBank[]).filter((b) => b.transferSupported === 1)
          )
        }
      })
      .catch(() => {
        /* silent */
      })
    return () => {
      alive = false
    }
  }, [])

  const selectedBank = useMemo(
    () => banks.find((b) => b.code === bankCode) || null,
    [banks, bankCode]
  )

  // ─── Default method theo config (fallback nếu disabled) ─────────────────
  useEffect(() => {
    const cfg = configQuery.data
    if (!cfg) return
    if (method === "balance" && !cfg.balanceEnabled && cfg.bankEnabled) {
      setMethod("bank")
    } else if (method === "bank" && !cfg.bankEnabled && cfg.balanceEnabled) {
      setMethod("balance")
    }
  }, [configQuery.data, method])

  // ─── Mutations ───────────────────────────────────────────────────────────
  const balanceMut = useMutation(
    trpc.affiliate.withdrawToBalance.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res?.message || "Đã rút thành công")
        setAmountInput("")
        invalidateAll()
      },
      onError: (err: any) =>
        toast.error(err?.message || "Rút tiền thất bại"),
    })
  )

  const bankMut = useMutation(
    trpc.affiliate.withdrawToBank.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res?.message || "Đã gửi yêu cầu")
        setAmountInput("")
        invalidateAll()
      },
      onError: (err: any) =>
        toast.error(err?.message || "Gửi yêu cầu thất bại"),
    })
  )

  function invalidateAll() {
    queryClient.invalidateQueries({
      queryKey: trpc.affiliate.getStats.queryKey(),
    })
    queryClient.invalidateQueries({
      queryKey: trpc.affiliate.getWithdrawHistory.queryKey(),
    })
  }

  // ─── Computed validation ─────────────────────────────────────────────────
  const refMoney = statsQuery.data?.refMoney ?? 0
  const minWithdraw = configQuery.data?.minWithdraw ?? 1000
  const maxWithdraw = configQuery.data?.maxWithdraw ?? 10_000_000

  const canSubmit = useMemo(() => {
    if (configQuery.data && !configQuery.data.enabled) return false
    if (minWithdraw > 0 && parsedAmount < minWithdraw) return false
    if (maxWithdraw > 0 && parsedAmount > maxWithdraw) return false
    if (parsedAmount > refMoney) return false
    if (method === "bank") {
      if (!bankCode || !stk.trim() || !accountName.trim()) return false
    }
    return true
  }, [
    configQuery.data,
    parsedAmount,
    minWithdraw,
    maxWithdraw,
    refMoney,
    method,
    bankCode,
    stk,
    accountName,
  ])

  const isSubmitting = balanceMut.isPending || bankMut.isPending

  // ─── Handlers ────────────────────────────────────────────────────────────
  const submit = useCallback(() => {
    if (!canSubmit || isSubmitting) return
    if (method === "balance") {
      balanceMut.mutate({ amount: parsedAmount })
    } else {
      bankMut.mutate({
        amount: parsedAmount,
        bank: bankCode,
        stk: stk.trim(),
        name: accountName.trim().toUpperCase(),
      })
    }
  }, [
    canSubmit,
    isSubmitting,
    method,
    parsedAmount,
    bankCode,
    stk,
    accountName,
    balanceMut,
    bankMut,
  ])

  const handleLimitChange = useCallback((n: number) => {
    setLimit(n)
    setPage(1)
  }, [])

  // ─── Outputs ─────────────────────────────────────────────────────────────
  const data = historyQuery.data
  const items = (data?.items || []) as any[]
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)

  return {
    // ── Settings ──
    config: configQuery.data,
    isLoadingConfig: configQuery.isLoading,

    // ── Stats ──
    stats: statsQuery.data,
    refMoney,
    isLoadingStats: statsQuery.isLoading,

    // ── Form ──
    method,
    setMethod,
    amount: amountInput,
    setAmount: setAmountInput,
    parsedAmount,
    minWithdraw,
    maxWithdraw,

    // Bank-specific
    banks,
    bankCode,
    setBankCode,
    selectedBank,
    stk,
    setStk,
    accountName,
    setAccountName,

    // ── Submit ──
    canSubmit,
    isSubmitting,
    submit,

    // ── History ──
    items,
    isLoadingHistory: historyQuery.isLoading,
    total,
    totalPages,
    startRow,
    endRow,
    page,
    setPage,
    limit,
    setLimit: handleLimitChange,
    searchInput,
    setSearchInput,
  }
}
