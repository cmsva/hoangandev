"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  IconSearch,
  IconAlertWarning,
  IconCopy,
  IconCheck,
  IconCircleCheck,
  IconEye,
  IconTrash,
  IconClock,
  IconQrCode,
  IconCreditCard,
  IconWallet,
  IconArrowDownToLine,
  IconExternalLink,
} from "@/components/icons"
import type { ComponentType } from "react"
import { useDeposit } from "@/hooks/use-deposit"
import { useEffect, useState, useMemo } from "react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}

function formatDate(d: Date | string) {
  const date = new Date(d)
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  const day = date.toLocaleDateString("vi-VN")
  return `${time} ${day}`
}

const QUICK_AMOUNTS = [
  20_000, 50_000, 100_000, 200_000,
  500_000, 1_000_000, 2_000_000, 5_000_000,
]

type BankAppOption = {
  appId: string
  appLogo: string
  appName: string
  bankName: string
  deeplink: string
  autofill?: number
}

const FALLBACK_BANK_APP_OPTIONS: BankAppOption[] = [
  { appId: "icb", appLogo: "", appName: "VietinBank iPay", bankName: "Ngan hang TMCP Cong thuong Viet Nam", deeplink: "https://dl.vietqr.io/pay?app=icb", autofill: 1 },
  { appId: "bidv", appLogo: "", appName: "BIDV SmartBanking", bankName: "Ngan hang TMCP Dau tu va Phat trien Viet Nam", deeplink: "https://dl.vietqr.io/pay?app=bidv", autofill: 1 },
  { appId: "ocb", appLogo: "", appName: "OCB OMNI", bankName: "Ngan hang TMCP Phuong Dong", deeplink: "https://dl.vietqr.io/pay?app=ocb", autofill: 1 },
  { appId: "acb", appLogo: "", appName: "ACB One", bankName: "Ngan hang TMCP A Chau", deeplink: "https://dl.vietqr.io/pay?app=acb", autofill: 1 },
  { appId: "mb", appLogo: "", appName: "MB Bank", bankName: "Ngan hang TMCP Quan doi", deeplink: "https://dl.vietqr.io/pay?app=mb", autofill: 0 },
  { appId: "vcb", appLogo: "", appName: "Vietcombank", bankName: "Ngan hang TMCP Ngoai Thuong Viet Nam", deeplink: "https://dl.vietqr.io/pay?app=vcb", autofill: 0 },
]

function useBankAppOptions(open: boolean) {
  const [apps, setApps] = useState<BankAppOption[]>(FALLBACK_BANK_APP_OPTIONS)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function loadApps() {
      setIsLoading(true)
      try {
        const res = await fetch("https://api.vietqr.io/v2/android-app-deeplinks")
        const json = (await res.json()) as { apps?: BankAppOption[] }
        if (!cancelled && Array.isArray(json.apps) && json.apps.length > 0) {
          setApps(json.apps)
        }
      } catch {
        if (!cancelled) setApps(FALLBACK_BANK_APP_OPTIONS)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadApps()
    return () => {
      cancelled = true
    }
  }, [open])

  return { apps, isLoading }
}

function buildVietQrDeepLink(appId: string, qrBank: any, amount: number, transId: string) {
  const params = new URLSearchParams({
    app: appId,
    ba: `${qrBank.accountNumber}@${String(qrBank.shortName).toLowerCase()}`,
    am: String(amount),
    tn: transId,
    bn: qrBank.accountName,
  })
  return `https://dl.vietqr.io/pay?${params.toString()}`
}

type StatusIcon = ComponentType<{ size?: number; className?: string }>

const STATUS_MAP: Record<number, { label: string; color: string; cls: string; Icon: StatusIcon }> = {
  0: { label: "Chờ thanh toán", color: "text-amber-500", cls: "border-amber-500/40 bg-amber-500/10", Icon: IconClock },
  1: { label: "Thành công", color: "text-emerald-600", cls: "border-emerald-500/40 bg-emerald-500/10", Icon: IconCircleCheck },
  2: { label: "Đã hủy / Hết hạn", color: "text-red-500", cls: "border-red-500/40 bg-red-500/10", Icon: IconAlertWarning },
}

// ─── Page (View) ───────────────────────────────────────────────────────────────

export function DepositClient() {
  const { collapsed } = useSidebar()
  const d = useDeposit()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                <a href="/dashboard" className="hover:text-foreground transition-colors">Trang chủ</a>
                <span>/</span>
                <span className="text-foreground font-medium">Nạp tiền ngân hàng</span>
              </nav>
              <h1 className="text-2xl font-bold tracking-tight">Nạp tiền qua ngân hàng</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Chọn ngân hàng, nhập số tiền và thanh toán bằng VietQR.
              </p>
            </div>

            {d.isLoading ? (
              <DepositSkeleton />
            ) : (
              <>
                {/* Bước 1: Chọn ngân hàng */}
                <Step1BankSelection
                  banks={d.banks}
                  selectedId={d.selectedBankId}
                  onSelect={d.setSelectedBankId}
                  bankMin={d.bankMin}
                  bankMax={d.bankMax}
                />

                {/* Grid 2 cột: Bước 2 + Chi tiết */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Step2AmountInput
                    amount={d.amount}
                    setAmount={d.setAmount}
                    parsedAmount={d.parsedAmount}
                    bankMin={d.bankMin}
                    selectedBank={d.selectedBank}
                    onSubmit={d.submitCreateInvoice}
                    isCreating={d.isCreating}
                  />

                  <TransactionDetails
                    selectedBank={d.selectedBank}
                    bonus={d.bonus}
                    onCopy={d.handleCopy}
                    copied={d.copied}
                  />
                </div>

                {/* Lịch sử */}
                <InvoiceHistoryTable
                  invoices={d.filteredInvoices}
                  isLoading={d.isLoadingInvoices}
                  searchQuery={d.searchQuery}
                  setSearchQuery={d.setSearchQuery}
                  onView={d.handleViewInvoice}
                  onCancel={(inv: any) => d.setCancelTarget(inv)}
                />
              </>
            )}
          </div>
        </main>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={d.modalOpen}
        onOpenChange={d.setModalOpen}
        transId={d.viewingTransId}
        status={d.viewingStatus}
        amount={d.viewingAmount}
        qrUrl={d.qrUrl}
        qrBank={d.qrBank}
        banks={d.banks}
        countdown={d.countdown}
        formatCountdown={d.formatCountdown}
        onCopy={d.handleCopy}
        copied={d.copied}
      />

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={!!d.cancelTarget}
        onOpenChange={(o) => { if (!o) d.setCancelTarget(null) }}
        title="Xác nhận hủy hóa đơn"
        description={d.cancelTarget ? (
          <>
            Hóa đơn <strong className="text-foreground font-mono">{d.cancelTarget.transId}</strong> sẽ bị hủy. Hành động này không thể hoàn tác.
          </>
        ) : null}
        variant="destructive"
        confirmText="Xác nhận hủy"
        cancelText="Đóng"
        isPending={d.isCancelling}
        onConfirm={d.handleConfirmCancel}
      >
        {d.cancelTarget && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ngân hàng</span>
              <span className="font-medium">{d.cancelTarget.gateway}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Số tiền</span>
              <span className="font-bold text-foreground tabular-nums">{formatMoney(d.cancelTarget.amount)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Step1BankSelection({ banks, selectedId, onSelect, bankMin, bankMax }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <IconCreditCard size={16} className="text-primary" />
        </div>
        <label className="text-base font-bold">Bước 1: Chọn phương thức nạp</label>
      </div>

      {banks.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
          Hiện chưa có ngân hàng thanh toán
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {banks.map((bank: any) => {
            const isSelected = selectedId === bank.id
            return (
              <button
                key={bank.id}
                type="button"
                onClick={() => onSelect(bank.id)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-md size-6 flex items-center justify-center">
                    <IconCheck size={14} />
                  </div>
                )}
                <div className="flex items-center justify-center h-12">
                  {bank.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bank.logo} alt={bank.shortName} className="h-10 w-auto object-contain" />
                  ) : (
                    <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">
                      {bank.shortName.slice(0, 2)}
                    </div>
                  )}
                </div>
                <span className="text-xs font-bold leading-tight">{bank.fullName}</span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-muted-foreground">
                    Min: <span className="font-semibold text-foreground">{bankMin > 0 ? formatMoney(bankMin) : "0đ"}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Max: <span className="font-semibold text-foreground">{bankMax > 0 ? formatMoney(bankMax) : "Không giới hạn"}</span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Step2AmountInput({ amount, setAmount, parsedAmount, bankMin, selectedBank, onSubmit, isCreating }: any) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <IconWallet size={16} className="text-primary" />
        </div>
        <label className="text-base font-bold">Bước 2: Nhập số tiền nạp</label>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Input
            type="text"
            placeholder={`Nhập số tiền (Tối thiểu ${formatMoney(bankMin)})`}
            value={amount ? parseInt(amount.replace(/\D/g, "") || "0").toLocaleString("vi-VN") : ""}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            className="h-11 text-lg font-medium pr-12"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">VNĐ</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((a) => (
            <Button
              key={a}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const current = parseInt(amount.replace(/\D/g, "") || "0")
                setAmount(String(current + a))
              }}
            >
              +{a.toLocaleString("vi-VN")}
            </Button>
          ))}
        </div>
      </div>

      <Button
        className="w-full h-11"
        disabled={parsedAmount < bankMin || !selectedBank || isCreating}
        onClick={onSubmit}
      >
        {isCreating ? "Đang tạo..." : "Tạo hóa đơn nạp tiền"}
      </Button>
    </div>
  )
}

function TransactionDetails({ selectedBank, bonus, onCopy, copied }: any) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-2">
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <IconEye size={16} className="text-primary" />
        </div>
        <h3 className="text-base font-bold">Chi tiết giao dịch</h3>
      </div>

      {selectedBank ? (
        <div className="space-y-0">
          <DetailRow
            label="Số tài khoản:"
            value={selectedBank.accountNumber}
            onCopy={() => onCopy(selectedBank.accountNumber, "stk")}
            copied={copied === "stk"}
            bold
          />
          <DetailRow label="Chủ tài khoản:" value={selectedBank.accountName} valueClass="text-red-500" />
          <DetailRow
            label="Thưởng thêm:"
            value={bonus.amount > 0 ? `+${formatMoney(bonus.amount)} (${bonus.percent}%)` : "+0đ"}
            valueClass="text-emerald-500"
          />
          <DetailRow
            label="Thực nhận:"
            value={bonus.final > 0 ? formatMoney(bonus.final) : "0đ"}
            valueClass="text-red-500 font-bold"
            labelBold
          />
        </div>
      ) : (
        <div className="h-40 flex flex-col items-center justify-center text-center opacity-50">
          <p className="text-sm italic">Vui lòng chọn ngân hàng để xem chi tiết</p>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, onCopy, copied, bold, valueClass, labelBold }: {
  label: string
  value: string
  onCopy?: () => void
  copied?: boolean
  bold?: boolean
  valueClass?: string
  labelBold?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/50 last:border-0">
      <span className={`text-sm shrink-0 ${labelBold ? "font-bold text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm text-right ${bold ? "font-bold font-mono" : "font-medium"} ${valueClass || "text-foreground"}`}>
          {value}
        </span>
        {onCopy && (
          <button onClick={onCopy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <IconCheck size={14} className="text-emerald-500" /> : <IconCopy size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}

type SortField = "transId" | "gateway" | "amount" | "createdAt"
type SortDir = "asc" | "desc"

function SortIcon({ active, dir }: { active: boolean; dir?: SortDir }) {
  return (
    <span className="text-muted-foreground">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`size-3.5 ${active ? "opacity-100" : "opacity-40"}`}>
        {dir === "asc" ? (
          <path d="m3 8 4-4 4 4M7 4v16" />
        ) : dir === "desc" ? (
          <path d="m3 16 4 4 4-4M7 20V4" />
        ) : (
          <>
            <path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" />
          </>
        )}
      </svg>
    </span>
  )
}

function InvoiceHistoryTable({ invoices, isLoading, searchQuery, setSearchQuery, onView, onCancel }: any) {
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

  // Sort + paginate client-side (data đã filtered bởi parent qua searchQuery)
  const sorted = useMemo(() => {
    const arr = [...invoices]
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
  }, [invoices, sortField, sortDir])

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const startRow = total > 0 ? (page - 1) * limit + 1 : 0
  const endRow = Math.min(page * limit, total)
  const pageData = sorted.slice((page - 1) * limit, page * limit)

  return (
    <div className="space-y-4">
      {/* Header + search */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Lịch sử nạp tiền</h3>
        <div className="relative max-w-sm flex-1">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm mã GD hoặc ngân hàng..."
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
                <button onClick={() => toggleSort("transId")} className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors">
                  Mã GD <SortIcon active={sortField === "transId"} dir={sortField === "transId" ? sortDir : undefined} />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort("gateway")} className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors">
                  Ngân hàng <SortIcon active={sortField === "gateway"} dir={sortField === "gateway" ? sortDir : undefined} />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort("amount")} className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors">
                  Số tiền / Thực nhận <SortIcon active={sortField === "amount"} dir={sortField === "amount" ? sortDir : undefined} />
                </button>
              </TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>
                <button onClick={() => toggleSort("createdAt")} className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors">
                  Thời gian <SortIcon active={sortField === "createdAt"} dir={sortField === "createdAt" ? sortDir : undefined} />
                </button>
              </TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
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
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-7 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : pageData.length > 0 ? (
              pageData.map((inv: any, index: number) => {
                const s = STATUS_MAP[inv.status] || STATUS_MAP[0]
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <span className="font-mono text-sm font-medium text-muted-foreground">{startRow + index}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{inv.transId}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{inv.gateway}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold text-emerald-600 tabular-nums">+{formatMoney(inv.amount)}</span>
                      {inv.finalAmount > inv.amount && (
                        <>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="text-sm font-medium tabular-nums">{formatMoney(inv.finalAmount)}</span>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.color}`}>
                        <s.Icon size={14} /> {s.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{formatDate(inv.createdAt)}</span>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onView(inv)}
                          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all hover:bg-accent hover:text-accent-foreground"
                        >
                          <IconEye size={14} /> Xem
                        </button>
                        {inv.status === 0 && (
                          <button
                            onClick={() => onCancel(inv)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-500 transition-all hover:bg-red-500/10"
                          >
                            <IconTrash size={14} /> Hủy
                          </button>
                        )}
                      </div>
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
          pageData.map((inv: any) => {
            const s = STATUS_MAP[inv.status] || STATUS_MAP[0]
            return (
              <div key={inv.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{inv.transId}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.color}`}>
                    <s.Icon size={14} /> {s.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Ngân hàng</p>
                    <div className="mt-0.5 font-medium">{inv.gateway}</div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Số tiền</p>
                    <div className="mt-0.5 font-semibold text-emerald-600 tabular-nums">+{formatMoney(inv.amount)}</div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Thời gian</p>
                    <div className="mt-0.5 text-sm">{formatDate(inv.createdAt)}</div>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onView(inv)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all hover:bg-accent hover:text-accent-foreground"
                    >
                      <IconEye size={14} /> Xem chi tiết
                    </button>
                    {inv.status === 0 && (
                      <button
                        onClick={() => onCancel(inv)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-500 transition-all hover:bg-red-500/10"
                      >
                        <IconTrash size={14} /> Hủy
                      </button>
                    )}
                  </div>
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
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}
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
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground text-sm">...</span>}
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
              <span className="sm:hidden text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
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

function PaymentModal({ open, onOpenChange, transId, status, amount, qrUrl, qrBank, banks, countdown, formatCountdown, onCopy, copied }: any) {
  const s = STATUS_MAP[status] || STATUS_MAP[0]
  const [bankDialogOpen, setBankDialogOpen] = useState(false)

  async function downloadInvoicePng() {
    if (!qrUrl) return
    const res = await fetch(qrUrl)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = `ma-chuyen-khoan-${transId || "deposit"}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent scrollable={false} className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Thanh toán hóa đơn</DialogTitle>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Mã giao dịch: <span className="font-mono">{transId}</span></p>
            <Badge variant="outline" className={`${s.cls} ${s.color} text-[10px] uppercase font-bold border`}>
              {s.label}
            </Badge>
          </div>
        </DialogHeader>

        {qrBank && (
          <div className="space-y-4 mt-2">
            <div className="flex justify-center">
              <div className="relative border-2 border-dashed border-border rounded-xl p-4 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="VietQR" className="w-[220px] h-[220px] object-contain" />
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <IconQrCode size={14} /> Quét mã QR để chuyển khoản nhanh
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-9 gap-1.5" onClick={downloadInvoicePng}>
                <IconArrowDownToLine size={14} /> Tải hóa đơn
              </Button>
              <Button type="button" variant="outline" className="h-9 gap-1.5" onClick={() => setBankDialogOpen(true)}>
                <IconExternalLink size={14} /> Mở ngân hàng
              </Button>
            </div>

            {status === 0 && (
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full">
                  <IconClock size={14} /> Hết hạn sau: {formatCountdown(countdown)}
                </span>
              </div>
            )}

            <div className="space-y-0">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Thông tin chuyển khoản</p>
              <DetailRow label="Ngân hàng" value={qrBank.fullName} bold />
              <DetailRow
                label="Số tài khoản"
                value={qrBank.accountNumber}
                valueClass="text-red-500"
                onCopy={() => onCopy(qrBank.accountNumber, "modal-stk")}
                copied={copied === "modal-stk"}
              />
              <DetailRow label="Chủ tài khoản" value={qrBank.accountName} bold />
              <DetailRow
                label="Nội dung CK"
                value={transId}
                valueClass="text-red-500"
                onCopy={() => onCopy(transId, "modal-content")}
                copied={copied === "modal-content"}
              />
              <DetailRow label="Số tiền" value={formatMoney(amount)} bold />
            </div>
          </div>
        )}
      </DialogContent>
      {qrBank && (
        <BankAppDialog
          open={bankDialogOpen}
          onOpenChange={setBankDialogOpen}
          banks={banks || []}
          qrBank={qrBank}
          amount={amount}
          transId={transId}
        />
      )}
    </Dialog>
  )
}

function BankAppDialog({ open, onOpenChange, qrBank, amount, transId }: any) {
  const [search, setSearch] = useState("")
  const { apps, isLoading } = useBankAppOptions(open)
  const filteredBanks = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return apps
    return apps.filter((app) =>
      `${app.appId} ${app.appName} ${app.bankName}`.toLowerCase().includes(q)
    )
  }, [apps, search])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Mở nhanh ngân hàng</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Chọn app ngân hàng để mở và gửi kèm thông tin chuyển khoản VietQR.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm ngân hàng, app hoặc mã bank..."
              className="h-10 pl-9"
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Tự động điền thông tin chuyển khoản:</span>{" "}
            {formatMoney(amount)} - nội dung <span className="font-mono text-foreground">{transId}</span>. Nếu app chưa hỗ trợ điền sẵn, hãy dùng QR/thông tin CK ở hóa đơn.
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {isLoading && (
              <div className="col-span-full rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Đang tải danh sách ngân hàng từ VietQR...
              </div>
            )}
            {filteredBanks.map((bank) => {
              const deeplink = buildVietQrDeepLink(bank.appId, qrBank, amount, transId)
              return (
                <a
                  key={bank.appId}
                  href={deeplink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl border bg-background p-3 transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                    {bank.appLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bank.appLogo} alt={bank.appName} className="h-8 w-8 rounded-md object-cover" />
                    ) : (
                      <span className="text-xs font-bold">{bank.appId.slice(0, 3).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold group-hover:text-primary">{bank.appName}</p>
                      {bank.autofill === 1 && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">Auto</span>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{bank.bankName}</p>
                  </div>
                  <IconExternalLink size={14} className="shrink-0 text-muted-foreground group-hover:text-primary" />
                </a>
              )
            })}
            {!isLoading && filteredBanks.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Không tìm thấy ngân hàng phù hợp.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DepositSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[140px] rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="h-[260px] rounded-xl" />
      </div>
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  )
}

