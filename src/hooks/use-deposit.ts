"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { useSocket } from "@/components/realtime/SocketProvider"

/**
 * useDeposit — Layer 4 (Hook): client-side controller cho deposit page.
 *
 * Quản lý:
 *  - Server queries: banks, settings, promotions, invoices
 *  - Form state: bank selection, amount, computed bonus
 *  - Modal state: open/close payment dialog, viewing invoice info
 *  - Countdown từ expiredAt thực tế của server
 *  - Real-time polling status (5s interval)
 *  - Mutations: create / cancel invoice
 *  - UI helpers: copy clipboard, search filter
 *
 * View (page.tsx) chỉ destructure + render — KHÔNG có business logic.
 */
export function useDeposit() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const socket = useSocket()

  // ─── Server queries ──────────────────────────────────────────────────────
  const banksQuery = useQuery({
    ...trpc.deposit.getBanks.queryOptions(),
    staleTime: 30_000,
  }) as { data: any[]; isLoading: boolean }
  const settingsQuery = useQuery({
    ...trpc.deposit.getSettings.queryOptions(),
    staleTime: 30_000,
  }) as { data: any; isLoading: boolean }
  const promosQuery = useQuery({
    ...trpc.deposit.getPromotions.queryOptions(),
    staleTime: 30_000,
  }) as { data: any[]; isLoading: boolean }
  const invoicesQuery = useQuery({
    ...trpc.deposit.getInvoices.queryOptions(),
    staleTime: 10_000,
  }) as { data: any[]; isLoading: boolean; refetch: () => void }

  // ─── Form state ──────────────────────────────────────────────────────────
  const [selectedBankId, setSelectedBankId] = useState("")
  const [amountInput, setAmountInput] = useState("") // raw input có thể chứa "."
  const parsedAmount = useMemo(() => parseInt(amountInput.replace(/\D/g, "") || "0", 10), [amountInput])

  // ─── Modal / Viewing state ───────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [viewingTransId, setViewingTransId] = useState("")
  const [viewingStatus, setViewingStatus] = useState<number>(0)
  const [viewingAmount, setViewingAmount] = useState<number>(0)
  const [viewingBankShortName, setViewingBankShortName] = useState("")
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Cancel confirm state ────────────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState<any>(null)

  // ─── Search + copy UI state ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  // ─── Auto-select first bank khi load ─────────────────────────────────────
  useEffect(() => {
    if (banksQuery.data && banksQuery.data.length > 0 && !selectedBankId) {
      setSelectedBankId(banksQuery.data[0].id)
    }
  }, [banksQuery.data, selectedBankId])

  // ─── Computed: selected bank + bonus ─────────────────────────────────────
  const selectedBank = useMemo(
    () => banksQuery.data?.find((b: any) => b.id === selectedBankId) || null,
    [banksQuery.data, selectedBankId]
  )

  const bonus = useMemo(() => {
    const amt = parsedAmount
    if (!promosQuery.data || amt <= 0) return { percent: 0, amount: 0, final: amt }
    const sorted = [...promosQuery.data].sort((a: any, b: any) => b.amount - a.amount)
    for (const p of sorted) {
      if (amt >= p.amount) {
        const bonusAmt = Math.floor((amt * p.discount) / 100)
        return { percent: p.discount, amount: bonusAmt, final: amt + bonusAmt }
      }
    }
    return { percent: 0, amount: 0, final: amt }
  }, [parsedAmount, promosQuery.data])

  // ─── Filtered invoices (search) ──────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    const items = invoicesQuery.data || []
    if (!searchQuery) return items
    const q = searchQuery.toLowerCase()
    return items.filter(
      (h: any) =>
        h.transId.toLowerCase().includes(q) || h.gateway.toLowerCase().includes(q)
    )
  }, [invoicesQuery.data, searchQuery])

  // ─── QR URL computed từ viewing state ────────────────────────────────────
  const qrBank = useMemo(
    () => banksQuery.data?.find((b: any) => b.shortName === viewingBankShortName) || null,
    [banksQuery.data, viewingBankShortName]
  )
  const qrUrl = useMemo(() => {
    if (!qrBank) return ""
    const params = new URLSearchParams({
      bank: qrBank.shortName,
      account: qrBank.accountNumber,
      amount: String(viewingAmount),
      addInfo: viewingTransId,
      accountName: qrBank.accountName,
    })
    return `/api/deposit/vietqr?${params.toString()}`
  }, [qrBank, viewingAmount, viewingTransId])

  // ─── Mutations ───────────────────────────────────────────────────────────
  const createMut = useMutation(
    trpc.deposit.createInvoice.mutationOptions({
      onSuccess: (res: any) => {
        toast.success("Tạo hóa đơn thành công")
        // Open payment modal với data từ server
        setViewingTransId(res.transId)
        setViewingStatus(0)
        setViewingAmount(res.amount)
        setViewingBankShortName(res.bankShortName)
        // Countdown tính từ expiredAt server trả về
        if (res.expiredAt) {
          const remaining = Math.max(0, Math.floor((new Date(res.expiredAt).getTime() - Date.now()) / 1000))
          setCountdown(remaining)
        } else {
          setCountdown(0)
        }
        setModalOpen(true)
        invoicesQuery.refetch()
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  const cancelMut = useMutation(
    trpc.deposit.cancelInvoice.mutationOptions({
      onSuccess: () => {
        toast.success("Đã hủy hóa đơn")
        setCancelTarget(null)
        queryClient.invalidateQueries({ queryKey: trpc.deposit.getInvoices.queryKey() })
      },
      onError: (err: any) => toast.error(err.message),
    })
  )

  // ─── Countdown tick ──────────────────────────────────────────────────────
  useEffect(() => {
    if (modalOpen && viewingStatus === 0 && countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1))
      }, 1000)
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [modalOpen, viewingStatus, countdown])

  // ─── Khi countdown chạm 0 → fetch status ngay (không đợi poll 5s) ───────
  useEffect(() => {
    if (!modalOpen || viewingStatus !== 0 || countdown !== 0 || !viewingTransId) return
    let cancelled = false
    ;(async () => {
      try {
        const result = (await queryClient.fetchQuery(
          trpc.deposit.checkStatus.queryOptions({ transId: viewingTransId })
        )) as any
        if (cancelled) return
        if (result.status !== 0) {
          setViewingStatus(result.status)
          if (result.status === 2) toast.error("Hóa đơn đã hết hạn")
          queryClient.invalidateQueries({ queryKey: trpc.deposit.getInvoices.queryKey() })
        }
      } catch {
        /* silent */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, viewingStatus, countdown, viewingTransId])

  // ─── Real-time status: poll 15s (fallback) + socket deposit:success (instant) ──
  useEffect(() => {
    if (!modalOpen || viewingStatus !== 0 || !viewingTransId) return

    const checkNow = async () => {
      try {
        const result = (await queryClient.fetchQuery(
          trpc.deposit.checkStatus.queryOptions({ transId: viewingTransId })
        )) as any
        if (result.status !== 0) {
          setViewingStatus(result.status)
          if (result.status === 1) toast.success("Nạp tiền thành công!")
          else if (result.status === 2) toast.error("Hóa đơn đã hủy/hết hạn")
          queryClient.invalidateQueries({ queryKey: trpc.deposit.getInvoices.queryKey() })
        }
      } catch {
        /* silent */
      }
    }

    // Poll 15s làm fallback (socket lo phần tức thì).
    const poll = setInterval(checkNow, 15_000)

    // Socket: tiền về → check ngay (server chỉ emit cho đúng transId của user).
    const onDeposit = (payload: { transId?: string } = {}) => {
      if (!payload.transId || payload.transId === viewingTransId) void checkNow()
    }
    socket?.on("deposit:success", onDeposit)
    socket?.on("invoice:update", onDeposit)

    return () => {
      clearInterval(poll)
      socket?.off("deposit:success", onDeposit)
      socket?.off("invoice:update", onDeposit)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, viewingStatus, viewingTransId, socket])

  // ─── Handlers ────────────────────────────────────────────────────────────
  const submitCreateInvoice = useCallback(() => {
    const bankMin = settingsQuery.data?.bankMin ?? 10000
    if (parsedAmount < bankMin || !selectedBankId) return
    createMut.mutate({ bankId: selectedBankId, amount: parsedAmount })
  }, [parsedAmount, selectedBankId, settingsQuery.data, createMut])

  const handleViewInvoice = useCallback(
    (inv: any) => {
      setViewingTransId(inv.transId)
      setViewingStatus(inv.status)
      setViewingAmount(inv.amount)
      setViewingBankShortName(inv.gateway)
      // Countdown tính từ expiredAt thực tế của invoice
      if (inv.status === 0 && inv.expiredAt) {
        const remaining = Math.max(0, Math.floor((new Date(inv.expiredAt).getTime() - Date.now()) / 1000))
        setCountdown(remaining)
      } else {
        setCountdown(0)
      }
      // Auto-select bank theo gateway
      const bank = banksQuery.data?.find((b: any) => b.shortName === inv.gateway)
      if (bank) setSelectedBankId(bank.id)
      setModalOpen(true)
    },
    [banksQuery.data]
  )

  const handleCopy = useCallback((text: string, field: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  const handleConfirmCancel = useCallback(() => {
    if (cancelTarget) cancelMut.mutate({ transId: cancelTarget.transId })
  }, [cancelTarget, cancelMut])

  const formatCountdown = useCallback((s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    const pad = (n: number) => n.toString().padStart(2, "0")
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`
    return `${pad(m)}:${pad(sec)}`
  }, [])

  return {
    // ── Server data ────────
    banks: banksQuery.data || [],
    settings: settingsQuery.data,
    promotions: promosQuery.data || [],
    invoices: invoicesQuery.data || [],
    filteredInvoices,
    isLoading: banksQuery.isLoading || settingsQuery.isLoading,
    isLoadingInvoices: invoicesQuery.isLoading,

    // ── Form state ────────
    selectedBankId,
    setSelectedBankId,
    selectedBank,
    amount: amountInput,
    setAmount: setAmountInput,
    parsedAmount,
    bonus,

    // ── Bank limits ───────
    bankMin: settingsQuery.data?.bankMin ?? 10000,
    bankMax: settingsQuery.data?.bankMax ?? 0,

    // ── Modal state ───────
    modalOpen,
    setModalOpen,
    viewingTransId,
    viewingStatus,
    viewingAmount,
    viewingBankShortName,
    qrBank,
    qrUrl,
    countdown,
    formatCountdown,

    // ── Cancel state ──────
    cancelTarget,
    setCancelTarget,
    handleConfirmCancel,
    isCancelling: cancelMut.isPending,

    // ── Search ────────────
    searchQuery,
    setSearchQuery,

    // ── Copy ──────────────
    copied,
    handleCopy,

    // ── Handlers ──────────
    submitCreateInvoice,
    handleViewInvoice,

    // ── States ────────────
    isCreating: createMut.isPending,
  }
}
