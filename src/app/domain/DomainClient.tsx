"use client"

import { useEffect, useMemo, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/toast"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

interface WhoisRowResult {
  available: boolean
  registered: boolean
  error: boolean
  source: string
  reason: string | null
  registrar: string | null
  registrantName: string | null
  createdAt: string | null
  expiredAt: string | null
  nameservers: string[]
}

export function DomainClient() {
  const { collapsed } = useSidebar()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Hero search input
  const [heroInput, setHeroInput] = useState("")
  // sld đã được "khóa" sau khi user nhấn KIỂM TRA — dùng để ráp với từng TLD trong bảng
  const [activeSld, setActiveSld] = useState<string | null>(null)

  // Batch whois result map: { "abc.com": { available, registered, ... } }
  const [whoisMap, setWhoisMap] = useState<Record<string, WhoisRowResult>>({})

  // TLD list filter
  const [filterInput, setFilterInput] = useState("")
  const [filterSearch, setFilterSearch] = useState("")
  const [page, setPage] = useState(1)

  // Modal đăng ký
  const [registerModal, setRegisterModal] = useState<{
    tld: any
    sld: string
    ns1: string
    ns2: string
    regName: string
    regAddress1: string
    regAddress2: string
    regProvince: string
    regPhone: string
    regZip: string
  } | null>(null)

  useEffect(() => {
    const id = setTimeout(() => {
      if (filterInput !== filterSearch) {
        setFilterSearch(filterInput.trim().toLowerCase())
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [filterInput, filterSearch])

  const { data: tldsData, isLoading: tldsLoading, isFetching } = useQuery({
    ...trpc.domain.listTlds.queryOptions({
      page,
      limit: 20,
      search: filterSearch || undefined,
      activeOnly: true,
    }),
    placeholderData: keepPreviousData,
  }) as { data: any; isLoading: boolean; isFetching: boolean }

  const tlds = tldsData?.items ?? []
  const totalPages = tldsData?.pagination?.totalPages ?? 1
  const total = tldsData?.pagination?.total ?? 0

  // ─── Whois BATCH mutation — chia parallel ────────────────────────────────
  const whoisBatchMut = useMutation({
    ...trpc.domain.whoisBatch.mutationOptions(),
    onSuccess: (res: any) => {
      // Merge thay vì replace để giữ kết quả cũ khi user phân trang
      setWhoisMap((prev) => ({ ...prev, ...res.results }))
    },
    onError: (err: any) => {
      toast.error(err?.message || "Tra cứu thất bại")
    },
  })

  // Mỗi khi đổi page hoặc filter → batch lookup TLDs hiện đang nhìn thấy
  // (chỉ gọi nếu user đã có active sld)
  useEffect(() => {
    if (!activeSld || tldsLoading || tlds.length === 0) return
    const targets: string[] = []
    for (const t of tlds) {
      const fullDomain = `${activeSld}.${t.tld}`
      if (whoisMap[fullDomain] === undefined) {
        targets.push(fullDomain)
      }
    }
    if (targets.length === 0) return
    // Chia thành chunks 20 (giới hạn input của API)
    for (let i = 0; i < targets.length; i += 20) {
      const chunk = targets.slice(i, i + 20)
      whoisBatchMut.mutate({ domains: chunk })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSld, tlds, tldsLoading])

  const registerMut = useMutation({
    ...trpc.domain.register.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(res.message || "Đăng ký domain thành công")
      setRegisterModal(null)
      setHeroInput("")
      setActiveSld(null)
      setWhoisMap({})
      queryClient.invalidateQueries({ queryKey: trpc.dashboard.stats.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.dashboard.recentTransactions.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.domain.myOrders.queryKey() })
      router.refresh()
      router.push("/customer/history/domain")
    },
    onError: (err: any) => {
      toast.error(err?.message || "Đăng ký thất bại")
    },
  })

  // ─── Hero search submit ──────────────────────────────────────────────────
  const handleHeroCheck = () => {
    const v = heroInput
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
    if (!v) {
      toast.error("Vui lòng nhập tên miền")
      return
    }

    // Tách sld + tld nếu user gõ full domain
    const parts = v.split(".")
    const sld = parts[0]
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(sld)) {
      toast.error("Tên miền không hợp lệ")
      return
    }
    if (sld.length < 4) {
      toast.error("Tên miền phải có ít nhất 4 ký tự (tên ngắn thường là domain premium giá cao)")
      return
    }

    // Reset whois map mới mỗi khi sld đổi
    if (activeSld !== sld) {
      setWhoisMap({})
    }
    setActiveSld(sld)

    // Nếu user đã gõ TLD cụ thể → filter table về TLD đó để priority show
    if (parts.length >= 2) {
      const tldGuess = parts.slice(1).join(".")
      setFilterInput(tldGuess)
    } else {
      setFilterInput("")
    }
    setPage(1)
  }

  const openRegister = (tld: any) => {
    if (!activeSld) {
      toast.error("Vui lòng nhập tên miền và bấm KIỂM TRA trước")
      return
    }
    const fullDomain = `${activeSld}.${tld.tld}`
    const r = whoisMap[fullDomain]
    if (r && !r.available) {
      toast.error(r.reason || "Domain không khả dụng")
      return
    }
    setRegisterModal({
      tld,
      sld: activeSld,
      ns1: "ns1.example.com",
      ns2: "ns2.example.com",
      regName: "",
      regAddress1: "",
      regAddress2: "",
      regProvince: "",
      regPhone: "",
      regZip: "",
    })
  }

  const formatPrice = (n: number) => `${n.toLocaleString()}đ`

  // Tổng hợp summary
  const summary = useMemo(() => {
    if (!activeSld) return null
    let avail = 0
    let reg = 0
    let err = 0
    for (const t of tlds) {
      const r = whoisMap[`${activeSld}.${t.tld}`]
      if (!r) continue
      if (r.available) avail++
      else if (r.registered) reg++
      else if (r.error) err++
    }
    return { avail, reg, err, total: tlds.length }
  }, [tlds, whoisMap, activeSld])

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
          }`}
      >
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
                  <span className="text-foreground font-normal">Đăng ký tên miền</span>
                </nav>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Đăng ký tên miền</h1>
                <p className="text-sm text-muted-foreground">Kiểm tra tên miền trên 432+ đuôi tên miền song song</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="/customer/history/domain"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent transition-all"
                >
                  Tên miền của tôi
                </a>
              </div>
            </div>

            {/* HERO */}
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-card p-8 sm:p-12">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

              <div className="relative mx-auto max-w-3xl text-center">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                  ĐĂNG KÝ TÊN MIỀN
                </h2>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                  Bảo vệ thương hiệu của bạn trên Internet
                </p>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-0 sm:rounded-xl sm:border sm:bg-card sm:shadow-lg sm:p-1.5">
                  <div className="relative flex-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg>
                    <input
                      type="text"
                      autoFocus
                      value={heroInput}
                      onChange={(e) => setHeroInput(e.target.value.toLowerCase().replace(/\s/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && handleHeroCheck()}
                      placeholder="Nhập tên miền (vd: abc hoặc abc.com)"
                      maxLength={253}
                      className="h-12 w-full rounded-lg border border-input bg-background pl-12 pr-4 text-base font-medium shadow-xs outline-none focus-visible:border-primary focus-visible:ring-primary/30 focus-visible:ring-[3px] sm:rounded-md sm:border-0 sm:shadow-none sm:focus-visible:ring-0"
                    />
                  </div>
                  <button
                    onClick={handleHeroCheck}
                    disabled={!heroInput.trim() || whoisBatchMut.isPending}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-amber-500 px-8 text-sm font-bold text-white transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed sm:rounded-md"
                  >
                    {whoisBatchMut.isPending ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    )}
                    KIỂM TRA
                  </button>
                </div>

                {/* Active sld + summary */}
                {activeSld && summary && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-card border px-3 py-1.5">
                      <span className="text-muted-foreground">Đang kiểm tra:</span>
                      <strong className="font-mono text-primary">{activeSld}</strong>
                      <button
                        onClick={() => { setActiveSld(null); setWhoisMap({}); setHeroInput(""); setFilterInput("") }}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </span>
                    {summary.avail > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-green-500/10 px-2 py-1 font-medium text-green-600 dark:text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        {summary.avail} có thể đăng ký
                      </span>
                    )}
                    {summary.reg > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 font-medium text-red-600 dark:text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        {summary.reg} đã đăng ký
                      </span>
                    )}
                    {summary.err > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 font-medium text-amber-600 dark:text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {summary.err} lỗi
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* TLD Pricing Table */}
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Bảng giá tên miền</h3>
                  <p className="text-xs text-muted-foreground">
                    {total > 0 ? `${total} đuôi tên miền có sẵn` : "Đang tải..."}
                  </p>
                </div>
                <div className="relative max-w-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg>
                  <input
                    type="text"
                    placeholder="Lọc đuôi (vd: com, vn)..."
                    value={filterInput}
                    onChange={(e) => setFilterInput(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                  {isFetching && !tldsLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                  )}
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên miền</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ngày hết hạn</TableHead>
                      <TableHead>Giá đăng ký</TableHead>
                      <TableHead>Phí gia hạn</TableHead>
                      <TableHead className="text-end">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tldsLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-7 w-24 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : tlds.length > 0 ? (
                      tlds.map((t: any) => {
                        const fullDomain = activeSld ? `${activeSld}.${t.tld}` : null
                        const r = fullDomain ? whoisMap[fullDomain] : undefined
                        const isPending = activeSld && !r
                        const formatExpiry = r?.expiredAt
                          ? new Date(r.expiredAt).toLocaleDateString("vi-VN")
                          : "Hạn sử dụng 1 năm"

                        return (
                          <TableRow key={t.id}>
                            <TableCell>
                              {activeSld ? (
                                <span className="font-mono">
                                  <span className="text-foreground">{activeSld}</span>
                                  <span className="font-bold text-primary">.{t.tld}</span>
                                </span>
                              ) : (
                                <span className="font-mono font-bold text-base text-primary">.{t.tld}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {!activeSld ? (
                                <span className="text-xs text-muted-foreground">Bấm KIỂM TRA</span>
                              ) : isPending ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                                  Đang tra cứu...
                                </span>
                              ) : r?.available ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                  Có thể đăng ký
                                </span>
                              ) : r?.registered ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                  Đã đăng ký
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                                  Lỗi
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">{formatExpiry}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-bold">{formatPrice(t.priceSold)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">{formatPrice(t.renewSold)}</span>
                            </TableCell>
                            <TableCell className="text-end">
                              {!activeSld || isPending ? (
                                <button
                                  disabled
                                  className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
                                >
                                  Chờ kiểm tra
                                </button>
                              ) : r?.available ? (
                                <button
                                  onClick={() => openRegister(t)}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-amber-600 active:scale-95"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                                  Đăng ký ngay
                                </button>
                              ) : r?.registered ? (
                                <a
                                  href={`https://whois.inet.vn/?domain=${encodeURIComponent(fullDomain || "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 transition-all hover:bg-amber-500/20"
                                  title={r.registrar ? `Quản lý: ${r.registrar}` : ""}
                                >
                                  Whois miền
                                </a>
                              ) : (
                                <button
                                  disabled
                                  className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
                                  title={r?.reason ?? "Lỗi tra cứu"}
                                >
                                  Lỗi
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          Không tìm thấy đuôi tên miền nào.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {tldsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                      <Skeleton className="h-5 w-20" />
                      <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                  ))
                ) : tlds.length > 0 ? (
                  tlds.map((t: any) => {
                    const fullDomain = activeSld ? `${activeSld}.${t.tld}` : null
                    const r = fullDomain ? whoisMap[fullDomain] : undefined
                    const isPending = activeSld && !r

                    return (
                      <div key={t.id} className="rounded-lg border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          {activeSld ? (
                            <span className="font-mono text-base">
                              <span>{activeSld}</span>
                              <span className="font-bold text-primary">.{t.tld}</span>
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-lg text-primary">.{t.tld}</span>
                          )}
                          {!activeSld ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : isPending ? (
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                          ) : r?.available ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Có thể đăng ký
                            </span>
                          ) : r?.registered ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              Đã đăng ký
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              Lỗi
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Đăng ký</p>
                            <div className="mt-0.5 font-bold">{formatPrice(t.priceSold)}</div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Gia hạn</p>
                            <div className="mt-0.5 text-muted-foreground">{formatPrice(t.renewSold)}</div>
                          </div>
                        </div>
                        {activeSld && r?.available && (
                          <button
                            onClick={() => openRegister(t)}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 text-sm font-bold text-white transition-all hover:bg-amber-600 active:scale-95"
                          >
                            Đăng ký ngay
                          </button>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                    Không tìm thấy đuôi nào.
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && !tldsLoading && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Trang {page} / {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="h-8 rounded-md border bg-background px-3 text-xs hover:bg-accent disabled:opacity-40"
                    >
                      ← Trước
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="h-8 rounded-md border bg-background px-3 text-xs hover:bg-accent disabled:opacity-40"
                    >
                      Sau →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Register Modal */}
      {registerModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={() => !registerMut.isPending && setRegisterModal(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border bg-card p-6 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Xác nhận đăng ký</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vui lòng kiểm tra thông tin trước khi xác nhận thanh toán.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-gradient-to-br from-primary/10 to-card p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Tên miền</span>
                  <span className="text-lg font-extrabold font-mono text-primary">
                    {registerModal.sld}.{registerModal.tld.tld}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-border/50 pt-2">
                  <span className="text-sm text-muted-foreground">Tổng phí</span>
                  <span className="text-base font-bold text-foreground">{formatPrice(registerModal.tld.priceSold)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Nameserver 1
                  <input
                    type="text"
                    value={registerModal.ns1}
                    onChange={(e) =>
                      setRegisterModal((r) => r ? { ...r, ns1: e.target.value.toLowerCase() } : r)
                    }
                    placeholder="ns1.example.com"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Nameserver 2
                  <input
                    type="text"
                    value={registerModal.ns2}
                    onChange={(e) =>
                      setRegisterModal((r) => r ? { ...r, ns2: e.target.value.toLowerCase() } : r)
                    }
                    placeholder="ns2.example.com"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                </label>
              </div>

              {/* Thông tin chủ thể đăng ký — bắt buộc trước khi vào quản lý miền */}
              <div className="space-y-3 border-t border-border/50 pt-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Thông tin chủ thể</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Thông tin này dùng để đăng ký chủ sở hữu tên miền.
                  </p>
                </div>

                <label className="block text-sm font-medium">
                  Tên công ty hoặc cá nhân <span className="text-rose-500">*</span>
                  <input
                    type="text"
                    value={registerModal.regName}
                    onChange={(e) => setRegisterModal((r) => r ? { ...r, regName: e.target.value } : r)}
                    placeholder="VD: Công ty TNHH ABC hoặc Nguyễn Văn A"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Địa chỉ 1 <span className="text-rose-500">*</span>
                  <input
                    type="text"
                    value={registerModal.regAddress1}
                    onChange={(e) => setRegisterModal((r) => r ? { ...r, regAddress1: e.target.value } : r)}
                    placeholder="Số nhà, tên đường, phường/xã"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Địa chỉ 2 <span className="text-xs font-normal text-muted-foreground">(tuỳ chọn)</span>
                  <input
                    type="text"
                    value={registerModal.regAddress2}
                    onChange={(e) => setRegisterModal((r) => r ? { ...r, regAddress2: e.target.value } : r)}
                    placeholder="Quận/huyện hoặc thông tin bổ sung"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    Tỉnh thành <span className="text-rose-500">*</span>
                    <input
                      type="text"
                      value={registerModal.regProvince}
                      onChange={(e) => setRegisterModal((r) => r ? { ...r, regProvince: e.target.value } : r)}
                      placeholder="VD: Hà Nội"
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Số điện thoại <span className="text-rose-500">*</span>
                    <input
                      type="tel"
                      value={registerModal.regPhone}
                      onChange={(e) => setRegisterModal((r) => r ? { ...r, regPhone: e.target.value } : r)}
                      placeholder="VD: 0901234567"
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                  </label>
                </div>

                <label className="block text-sm font-medium">
                  Mã zip code <span className="text-rose-500">*</span>
                  <input
                    type="text"
                    value={registerModal.regZip}
                    onChange={(e) => setRegisterModal((r) => r ? { ...r, regZip: e.target.value.replace(/[^0-9]/g, "") } : r)}
                    placeholder="VD: 100000"
                    inputMode="numeric"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    Không biết mã zip?{" "}
                    <a
                      href="https://mabuuchinh.vn/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      Tra cứu tại mabuuchinh.vn
                    </a>
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setRegisterModal(null)}
                  disabled={registerMut.isPending}
                  className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    const reg = registerModal
                    if (!reg.regName.trim()) return toast.error("Vui lòng nhập tên công ty hoặc cá nhân")
                    if (!reg.regAddress1.trim()) return toast.error("Vui lòng nhập địa chỉ 1")
                    if (!reg.regProvince.trim()) return toast.error("Vui lòng nhập tỉnh thành")
                    if (reg.regPhone.trim().length < 8) return toast.error("Số điện thoại không hợp lệ")
                    if (reg.regZip.trim().length < 4) return toast.error("Mã zip không hợp lệ")
                    registerMut.mutate({
                      sld: reg.sld.toLowerCase(),
                      tldId: reg.tld.id,
                      ns1: reg.ns1.trim(),
                      ns2: reg.ns2.trim(),
                      registrant: {
                        name: reg.regName.trim(),
                        address1: reg.regAddress1.trim(),
                        address2: reg.regAddress2.trim(),
                        province: reg.regProvince.trim(),
                        phone: reg.regPhone.trim(),
                        zipCode: reg.regZip.trim(),
                      },
                    })
                  }}
                  disabled={registerMut.isPending}
                  className="flex-1 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {registerMut.isPending ? "Đang xử lý..." : "Xác nhận thanh toán"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

