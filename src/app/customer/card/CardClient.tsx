"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  IconLoader,
  IconChevronDown,
  IconChevronUp,
  IconSearch,
  IconCircleCheck,
  IconClock,
  IconAlertWarning,
} from "@/components/icons"
import type { ComponentType } from "react"
import { useCard } from "@/hooks/use-card"
import { useState, useMemo } from "react"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n)
}

function formatDate(d: Date | string | undefined | null) {
  if (!d) return "—"
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return "—"
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  const day = date.toLocaleDateString("vi-VN")
  return `${time} ${day}`
}

type StatusIcon = ComponentType<{ size?: number; className?: string }>

const STATUS_MAP: Record<string, { label: string; color: string; cls: string; Icon: StatusIcon }> = {
  pending: {
    label: "Đang xử lý",
    color: "text-amber-500",
    cls: "border-amber-500/40 bg-amber-500/10",
    Icon: IconClock,
  },
  completed: {
    label: "Thành công",
    color: "text-emerald-600",
    cls: "border-emerald-500/40 bg-emerald-500/10",
    Icon: IconCircleCheck,
  },
  error: {
    label: "Thất bại",
    color: "text-red-500",
    cls: "border-red-500/40 bg-red-500/10",
    Icon: IconAlertWarning,
  },
}

// ─── View ───────────────────────────────────────────────────────────────────

function CardPageContent() {
  const { collapsed } = useSidebar()
  const c = useCard()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            <PageHeader />

            {c.isLoading ? (
              <CardSkeleton />
            ) : (
              <>
                {c.cardNotice && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
                    {c.cardNotice}
                  </div>
                )}

                {!c.cardEnabled ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 font-medium">
                    Chức năng nạp thẻ đang tạm tắt.
                  </div>
                ) : (
                  <MainCard c={c} />
                )}
              </>
            )}

            <CardHistorySection
              cards={c.filteredCards}
              isLoading={c.isLoadingHistory}
              searchQuery={c.searchQuery}
              setSearchQuery={c.setSearchQuery}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div>
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
        <a href="/dashboard" className="hover:text-foreground transition-colors">
          Trang chủ
        </a>
        <span>/</span>
        <span className="text-foreground font-medium">Nạp thẻ cào</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight">Nạp thẻ cào</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        Nạp tiền bằng thẻ cào điện thoại hoặc thẻ game.
      </p>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Skeleton className="lg:col-span-7 h-[420px] rounded-xl" />
        <Skeleton className="lg:col-span-5 h-[420px] rounded-xl" />
      </div>
    </div>
  )
}

// ─── Main: Telco + Amount + Form ────────────────────────────────────────────

function MainCard({ c }: { c: ReturnType<typeof useCard> }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left: Telco + Amount */}
        <div className="lg:col-span-7 space-y-6">
          <TelcoSection c={c} />
          <AmountSection c={c} />
        </div>

        {/* Right: Card form + Summary */}
        <div className="lg:col-span-5">
          <CardInfoPanel c={c} />
        </div>
      </div>
    </div>
  )
}

function TelcoSection({ c }: { c: ReturnType<typeof useCard> }) {
  return (
    <div className="space-y-3">
      <StepLabel n={1}>Chọn nhà mạng</StepLabel>

      {c.isLoadingTelcos ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : c.telcos.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Chưa có nhà mạng nào</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {c.visibleTelcos.map((t: any) => {
              const isSelected = c.selectedTelco === t.name
              const logoSrc = t.img || `/telco/${t.name.toLowerCase()}.svg`
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => c.handleSelectTelco(t.name)}
                  className={`relative h-20 rounded-xl border-2 transition-all duration-200 overflow-hidden flex items-center justify-center p-2 ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border/50 bg-background hover:bg-muted/50"
                  }`}
                  title={t.name}
                  aria-label={t.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={t.name}
                    src={logoSrc}
                    className="object-contain p-3 absolute inset-0 w-full h-full"
                    loading="lazy"
                  />
                </button>
              )
            })}
          </div>

          {c.hasMoreTelcos && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => c.setShowAllTelcos(!c.showAllTelcos)}
            >
              {c.showAllTelcos ? (
                <>
                  <IconChevronUp size={16} className="mr-1" /> Thu gọn
                </>
              ) : (
                <>
                  <IconChevronDown size={16} className="mr-1" /> Xem thêm ({c.telcos.length - c.visibleTelcos.length})
                </>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function AmountSection({ c }: { c: ReturnType<typeof useCard> }) {
  return (
    <div className="space-y-3">
      <StepLabel n={2}>Chọn mệnh giá</StepLabel>

      {!c.selectedTelco ? (
        <p className="text-sm text-muted-foreground italic">Vui lòng chọn nhà mạng trước</p>
      ) : c.isLoadingAmounts ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : c.amounts.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nhà mạng này chưa có mệnh giá</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {c.amounts.map((a: any) => {
            const isSelected = c.selectedAmount === a.value
            return (
              <button
                key={a.id || a.value}
                type="button"
                onClick={() => c.setSelectedAmount(a.value)}
                className={`relative py-3 px-2 rounded-lg border text-sm font-semibold transition-all duration-200 ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-background hover:bg-muted/50"
                }`}
              >
                {formatNumber(a.value)} VNĐ
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CardInfoPanel({ c }: { c: ReturnType<typeof useCard> }) {
  return (
    <div className="bg-muted/30 rounded-2xl p-5 border border-border/50 space-y-5 h-full flex flex-col">
      <div className="space-y-4 flex-1">
        <StepLabel n={3}>Thông tin thẻ</StepLabel>

        <form
          id="card-form"
          onSubmit={(e) => {
            e.preventDefault()
            c.submitCard()
          }}
          className="space-y-3"
        >
          <FormField label="Số Serial" htmlFor="serial">
            <Input
              id="serial"
              type="text"
              placeholder="Nhập số serial..."
              maxLength={20}
              value={c.serial}
              onChange={(e: any) => c.setSerial(e.target.value)}
              className="h-9 bg-background"
              autoComplete="off"
            />
          </FormField>

          <FormField label="Mã thẻ cào" htmlFor="pin">
            <Input
              id="pin"
              type="text"
              placeholder="Nhập mã thẻ..."
              maxLength={20}
              value={c.pin}
              onChange={(e: any) => c.setPin(e.target.value)}
              className="h-9 bg-background"
              autoComplete="off"
            />
          </FormField>
        </form>
      </div>

      {/* Order Summary */}
      <div className="rounded-lg overflow-hidden">
        <div className="bg-muted/40 p-4 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Mệnh giá</span>
            <span className="font-semibold tabular-nums">
              {c.selectedAmount > 0 ? formatNumber(c.selectedAmount) : "0"}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Phí dịch vụ</span>
            <span className="text-red-500 font-medium">-{c.totalFeePercent}%</span>
          </div>
          <div className="h-px bg-border/50 border-t border-dashed" />
          <div className="flex justify-between items-center">
            <span className="font-bold text-base">THỰC NHẬN</span>
            <span className="font-bold text-xl text-emerald-600 dark:text-emerald-400 tabular-nums">
              {c.actualAmount > 0 ? formatNumber(c.actualAmount) : "0"} VNĐ
            </span>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        form="card-form"
        className="w-full h-11 text-sm font-bold"
        disabled={!c.canSubmit || c.isSubmitting}
      >
        {c.isSubmitting && <IconLoader size={16} className="animate-spin mr-2" />}
        {c.isSubmitting ? "ĐANG XỬ LÝ..." : "NẠP THẺ NGAY"}
      </Button>

      <div className="text-xs text-center text-muted-foreground/80 px-2 leading-relaxed">
        Bằng việc nạp thẻ, bạn đồng ý với chính sách và quy định về nạp đổi thẻ cào của hệ thống.
      </div>
    </div>
  )
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <Label className="text-base font-semibold flex items-center gap-2">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
        {n}
      </span>
      {children}
    </Label>
  )
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-xs uppercase text-muted-foreground font-bold tracking-wider"
      >
        {label}
      </Label>
      {children}
    </div>
  )
}

// ─── History — DataTable theo style deposit ────────────────────────────────

type SortField = "transId" | "telco" | "amount" | "createdAt"
type SortDir = "asc" | "desc"

function SortIcon({ active, dir }: { active: boolean; dir?: SortDir }) {
  return (
    <span className="text-muted-foreground">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-3.5 ${active ? "opacity-100" : "opacity-40"}`}
      >
        {dir === "asc" ? (
          <path d="m3 8 4-4 4 4M7 4v16" />
        ) : dir === "desc" ? (
          <path d="m3 16 4 4 4-4M7 20V4" />
        ) : (
          <>
            <path d="m21 16-4 4-4-4" />
            <path d="M17 20V4" />
            <path d="m3 8 4-4 4 4" />
            <path d="M7 4v16" />
          </>
        )}
      </svg>
    </span>
  )
}

function CardHistorySection({
  cards,
  isLoading,
  searchQuery,
  setSearchQuery,
}: {
  cards: any[]
  isLoading: boolean
  searchQuery: string
  setSearchQuery: (v: string) => void
}) {
  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
    setPage(1)
  }

  const sorted = useMemo(() => {
    const arr = [...cards]
    arr.sort((a: any, b: any) => {
      let av = a[sortField]
      let bv = b[sortField]
      if (sortField === "createdAt") {
        av = new Date(av).getTime()
        bv = new Date(bv).getTime()
      }
      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === "asc" ? av - bv : bv - av
    })
    return arr
  }, [cards, sortField, sortDir])

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)
  const pageData = sorted.slice((page - 1) * limit, page * limit)

  return (
    <div className="space-y-4">
      {/* Header + search */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Lịch sử nạp thẻ</h3>
        <div className="relative max-w-sm flex-1">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm mã GD, serial, nhà mạng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort("transId")}
                  className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors"
                >
                  Mã GD <SortIcon active={sortField === "transId"} dir={sortField === "transId" ? sortDir : undefined} />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort("telco")}
                  className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors"
                >
                  Nhà mạng <SortIcon active={sortField === "telco"} dir={sortField === "telco" ? sortDir : undefined} />
                </button>
              </TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort("amount")}
                  className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors"
                >
                  Mệnh giá / Thực nhận <SortIcon active={sortField === "amount"} dir={sortField === "amount" ? sortDir : undefined} />
                </button>
              </TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort("createdAt")}
                  className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors"
                >
                  Thời gian <SortIcon active={sortField === "createdAt"} dir={sortField === "createdAt" ? sortDir : undefined} />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : pageData.length > 0 ? (
              pageData.map((card: any, index: number) => {
                const s = STATUS_MAP[card.status] || STATUS_MAP.pending
                return (
                  <TableRow key={card.id}>
                    <TableCell>
                      <span className="font-mono text-sm font-medium text-muted-foreground">
                        {startRow + index}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{card.transId || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-bold uppercase">{card.telco}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs truncate max-w-[140px] block">{card.serial}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold text-red-500 tabular-nums">{formatMoney(card.amount)}</span>
                      {card.price > 0 && (
                        <>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="text-sm font-semibold text-emerald-600 tabular-nums">+{formatMoney(card.price)}</span>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.color}`}>
                        <s.Icon size={14} /> {s.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{formatDate(card.createdAt)}</span>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Chưa có giao dịch nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))
        ) : pageData.length > 0 ? (
          pageData.map((card: any) => {
            const s = STATUS_MAP[card.status] || STATUS_MAP.pending
            return (
              <div key={card.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase">{card.telco}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.color}`}>
                    <s.Icon size={14} /> {s.label}
                  </span>
                </div>
                <div className="text-xs font-mono text-muted-foreground">GD: {card.transId || "—"}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Mệnh giá</p>
                    <div className="mt-0.5 font-semibold text-red-500 tabular-nums">{formatMoney(card.amount)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Thực nhận</p>
                    <div className="mt-0.5 font-semibold text-emerald-600 tabular-nums">
                      {card.price > 0 ? `+${formatMoney(card.price)}` : "—"}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Serial</p>
                    <div className="mt-0.5 font-mono text-xs">{card.serial}</div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Thời gian</p>
                    <div className="mt-0.5 text-sm">{formatDate(card.createdAt)}</div>
                  </div>
                  {card.reason && (
                    <div className="col-span-2 text-xs text-red-500 line-clamp-2">{card.reason}</div>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            Chưa có giao dịch nào.
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Hiển thị {startRow}-{endRow} / {total} kết quả</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Dòng</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value))
                  setPage(1)
                }}
                className="h-8 w-[70px] rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 transition-all"
              >
                Trước
              </button>
              <span className="hidden sm:contents">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-muted-foreground text-sm">...</span>
                      )}
                      <button
                        onClick={() => setPage(p)}
                        className={`inline-flex items-center justify-center rounded-md h-8 min-w-8 px-3 text-sm font-medium transition-all ${
                          p === page
                            ? "bg-primary text-primary-foreground"
                            : "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
              </span>
              <span className="sm:hidden text-sm text-muted-foreground px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 transition-all"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function CardClient() {
  return (
    <SidebarProvider>
      <CardPageContent />
    </SidebarProvider>
  )
}
