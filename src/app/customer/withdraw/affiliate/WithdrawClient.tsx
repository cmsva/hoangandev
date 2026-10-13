"use client"

import { useState } from "react"


import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  IconCheck,
  IconLoader,
  IconWallet,
  IconCreditCard,
  IconCircleCheck,
  IconClock,
  IconAlertWarning,
  IconSearch,
} from "@/components/icons"
import { useAffiliateWithdraw } from "@/hooks/use-affiliate"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}

function formatDate(d: Date | string | undefined | null) {
  if (!d) return "—"
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return "—"
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  const day = date.toLocaleDateString("vi-VN")
  return `${time} ${day}`
}

const QUICK_AMOUNTS = [10_000, 50_000, 100_000, 500_000, 1_000_000]

const STATUS_MAP: Record<number, { label: string; color: string; Icon: typeof IconCircleCheck }> = {
  0: { label: "Chờ duyệt", color: "text-amber-500", Icon: IconClock },
  1: { label: "Hoàn tất", color: "text-emerald-600", Icon: IconCircleCheck },
  2: { label: "Từ chối", color: "text-red-500", Icon: IconAlertWarning },
}

// ─── Page (View) ────────────────────────────────────────────────────────────

function AffiliateWithdrawContent() {
  const { collapsed } = useSidebar()
  const w = useAffiliateWithdraw()

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

            {w.isLoadingConfig || w.isLoadingStats ? (
              <Skeleton className="h-[420px] rounded-xl" />
            ) : !w.config?.enabled ? (
              <DisabledNotice />
            ) : (
              <WithdrawCard w={w} />
            )}

            <HistorySection w={w} />
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Page Header ────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div>
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
        <a href="/dashboard" className="hover:text-foreground transition-colors">
          Trang chủ
        </a>
        <span>/</span>
        <a href="/customer/affiliate" className="hover:text-foreground transition-colors">
          Tiếp thị liên kết
        </a>
        <span>/</span>
        <span className="text-foreground font-medium">Rút tiền</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight">Rút hoa hồng</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        Rút hoa hồng về số dư chính (tức thì) hoặc về tài khoản ngân hàng (admin duyệt).
      </p>
    </div>
  )
}

function DisabledNotice() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-700 dark:text-amber-400">
      Chương trình affiliate hiện đang tạm ngưng. Vui lòng quay lại sau.
    </div>
  )
}

// ─── Withdraw Form ──────────────────────────────────────────────────────────

function WithdrawCard({ w }: { w: ReturnType<typeof useAffiliateWithdraw> }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left: chọn method + amount */}
        <div className="lg:col-span-7 space-y-6">
          <MethodPicker w={w} />
          <AmountInput w={w} />
        </div>

        {/* Right: thông tin nhận + submit */}
        <div className="lg:col-span-5">
          <RecipientPanel w={w} />
        </div>
      </div>
    </div>
  )
}

function MethodPicker({ w }: { w: ReturnType<typeof useAffiliateWithdraw> }) {
  return (
    <div className="space-y-3">
      <StepLabel n={1}>Chọn phương thức rút</StepLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {w.config?.balanceEnabled && (
          <button
            type="button"
            onClick={() => w.setMethod("balance")}
            className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
              w.method === "balance"
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border/50 hover:border-primary/40"
            }`}
          >
            {w.method === "balance" && (
              <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-md size-5 flex items-center justify-center">
                <IconCheck size={12} />
              </div>
            )}
            <IconWallet size={28} className="text-primary" />
            <span className="text-sm font-bold leading-tight">Cộng vào số dư chính</span>
            <span className="text-[10px] text-muted-foreground">Nhận ngay lập tức</span>
          </button>
        )}
        {w.config?.bankEnabled && (
          <button
            type="button"
            onClick={() => w.setMethod("bank")}
            className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
              w.method === "bank"
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border/50 hover:border-primary/40"
            }`}
          >
            {w.method === "bank" && (
              <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-md size-5 flex items-center justify-center">
                <IconCheck size={12} />
              </div>
            )}
            <IconCreditCard size={28} className="text-primary" />
            <span className="text-sm font-bold leading-tight">Rút về tài khoản ngân hàng</span>
            <span className="text-[10px] text-muted-foreground">Admin duyệt trong 24h</span>
          </button>
        )}
      </div>
    </div>
  )
}

function AmountInput({ w }: { w: ReturnType<typeof useAffiliateWithdraw> }) {
  const display = w.amount
    ? parseInt(w.amount.replace(/\D/g, "") || "0", 10).toLocaleString("vi-VN")
    : ""

  return (
    <div className="space-y-3">
      <StepLabel n={2}>Nhập số tiền cần rút</StepLabel>
      <div className="space-y-3">
        <div className="relative">
          <Input
            type="text"
            placeholder="0"
            value={display}
            onChange={(e: any) => {
              const raw = e.target.value.replace(/\D/g, "")
              w.setAmount(raw)
            }}
            className="h-11 text-lg font-medium pr-12"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            VNĐ
          </div>
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
                const current = parseInt(w.amount.replace(/\D/g, "") || "0", 10)
                w.setAmount(String(current + a))
              }}
            >
              +{a.toLocaleString("vi-VN")}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => w.setAmount("")}
          >
            Xóa
          </Button>
        </div>
        <div className="flex justify-between items-center text-[11px] text-muted-foreground px-1">
          <span>
            Tối thiểu: {w.minWithdraw > 0 ? w.minWithdraw.toLocaleString("vi-VN") : "Không giới hạn"} • Tối đa:{" "}
            {w.maxWithdraw > 0 ? w.maxWithdraw.toLocaleString("vi-VN") : "Không giới hạn"}
          </span>
          <span className="font-medium text-foreground">
            Số dư: {formatMoney(w.refMoney)}
          </span>
        </div>
      </div>
    </div>
  )
}

function RecipientPanel({ w }: { w: ReturnType<typeof useAffiliateWithdraw> }) {
  return (
    <div className="bg-muted/30 rounded-2xl p-5 border border-border/50 space-y-4 h-full flex flex-col">
      <StepLabel n={3}>{w.method === "balance" ? "Xác nhận" : "Thông tin nhận"}</StepLabel>

      <div className="space-y-3 flex-1">
        {w.method === "bank" && <BankFields w={w} />}

        {/* Summary */}
        <div className="space-y-2 pt-3 border-t border-dashed border-border/50">
          <SummaryRow label="Phương thức" value={w.method === "balance" ? "Số dư chính" : w.selectedBank?.shortName || "—"} />
          <SummaryRow label="Số tiền" value={w.parsedAmount > 0 ? formatMoney(w.parsedAmount) : "0đ"} valueClass="text-red-500 font-semibold" />
          {w.method === "bank" && w.stk && (
            <SummaryRow label="Số tài khoản" value={w.stk} valueClass="font-mono" />
          )}
          {w.method === "bank" && w.accountName && (
            <SummaryRow label="Chủ tài khoản" value={w.accountName} />
          )}
        </div>
      </div>

      <Button
        type="button"
        className="w-full h-11 text-sm font-bold"
        disabled={!w.canSubmit || w.isSubmitting}
        onClick={w.submit}
      >
        {w.isSubmitting && <IconLoader size={16} className="animate-spin mr-2" />}
        {w.isSubmitting
          ? "ĐANG XỬ LÝ..."
          : w.method === "balance"
          ? "XÁC NHẬN RÚT"
          : "GỬI YÊU CẦU"}
      </Button>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        {w.method === "balance"
          ? "Tiền cộng vào số dư chính ngay lập tức."
          : "Yêu cầu sẽ được admin xử lý trong vòng 24h."}
      </p>
    </div>
  )
}

function BankFields({ w }: { w: ReturnType<typeof useAffiliateWithdraw> }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-3">
      <FormField label="Ngân hàng">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-9 bg-background"
            >
              <span className="truncate flex items-center gap-2">
                {w.selectedBank ? (
                  <>
                    <span className="font-semibold">{w.selectedBank.shortName}</span>
                    <span className="text-muted-foreground text-xs truncate">
                      {w.selectedBank.name}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Chọn ngân hàng...</span>
                )}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Tìm ngân hàng..." />
              <CommandList>
                <CommandEmpty>Không tìm thấy ngân hàng.</CommandEmpty>
                <CommandGroup>
                  {w.banks.map((bank: any) => (
                    <CommandItem
                      key={bank.code}
                      value={`${bank.shortName} ${bank.name}`}
                      onSelect={() => {
                        w.setBankCode(bank.code === w.bankCode ? "" : bank.code)
                        setOpen(false)
                      }}
                    >
                      <span className="truncate font-semibold mr-2">{bank.shortName}</span>
                      <span className="text-muted-foreground text-xs truncate">
                        {bank.name}
                      </span>
                      {w.bankCode === bank.code && (
                        <IconCheck size={14} className="ml-auto text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </FormField>

      <FormField label="Số tài khoản">
        <Input
          value={w.stk}
          onChange={(e: any) => w.setStk(e.target.value.replace(/\D/g, ""))}
          placeholder="Chỉ nhập số"
          className="h-9 bg-background"
          maxLength={30}
          inputMode="numeric"
        />
      </FormField>

      <FormField label="Tên chủ tài khoản">
        <Input
          value={w.accountName}
          onChange={(e: any) => w.setAccountName(e.target.value.toUpperCase())}
          placeholder="NGUYEN VAN A"
          className="h-9 bg-background uppercase"
          maxLength={80}
        />
      </FormField>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <Label className="text-base font-semibold flex items-center gap-2">
      <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
        {n}
      </span>
      {children}
    </Label>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">
        {label}
      </Label>
      {children}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex justify-between items-center text-sm gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-medium text-right truncate ${valueClass || ""}`}>{value}</span>
    </div>
  )
}

// ─── History Table ──────────────────────────────────────────────────────────

function HistorySection({ w }: { w: ReturnType<typeof useAffiliateWithdraw> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Lịch sử rút tiền</h3>
        <div className="relative max-w-sm flex-1">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Tìm theo mã GD, bank, STK..."
            value={w.searchInput}
            onChange={(e) => w.setSearchInput(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      </div>

      <DesktopTable items={w.items} isLoading={w.isLoadingHistory} startRow={w.startRow} />
      <MobileCards items={w.items} isLoading={w.isLoadingHistory} />

      <PaginationBar
        total={w.total}
        totalPages={w.totalPages}
        page={w.page}
        limit={w.limit}
        startRow={w.startRow}
        endRow={w.endRow}
        setPage={w.setPage}
        setLimit={w.setLimit}
        isLoading={w.isLoadingHistory}
      />
    </div>
  )
}

function DesktopTable({
  items,
  isLoading,
  startRow,
}: {
  items: any[]
  isLoading: boolean
  startRow: number
}) {
  return (
    <div className="hidden md:block rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead>Mã GD</TableHead>
            <TableHead>Phương thức</TableHead>
            <TableHead>Số tài khoản</TableHead>
            <TableHead className="text-right">Số tiền</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Thời gian</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : items.length > 0 ? (
            items.map((it: any, i: number) => {
              const s = STATUS_MAP[it.status] || STATUS_MAP[0]
              return (
                <TableRow key={it.id}>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">
                      {startRow + i}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-medium">{it.transId}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {it.bank === "BALANCE" ? "Số dư chính" : it.bank}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {it.bank === "BALANCE" ? "—" : `${it.stk} • ${it.name}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold tabular-nums block text-right">
                      {formatMoney(it.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.color}`}>
                      <s.Icon size={14} /> {s.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(it.createdAt)}
                    </span>
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
  )
}

function MobileCards({ items, isLoading }: { items: any[]; isLoading: boolean }) {
  return (
    <div className="md:hidden space-y-3">
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))
      ) : items.length > 0 ? (
        items.map((it: any) => {
          const s = STATUS_MAP[it.status] || STATUS_MAP[0]
          return (
            <div key={it.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium">{it.transId}</span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.color}`}>
                  <s.Icon size={14} /> {s.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Phương thức</p>
                  <p className="mt-0.5">{it.bank === "BALANCE" ? "Số dư chính" : it.bank}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Số tiền</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatMoney(it.amount)}</p>
                </div>
                {it.bank !== "BALANCE" && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Số tài khoản</p>
                    <p className="mt-0.5 font-mono text-xs">{it.stk} • {it.name}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Thời gian</p>
                  <p className="mt-0.5 text-xs">{formatDate(it.createdAt)}</p>
                </div>
                {it.reason && (
                  <div className="col-span-2 text-xs text-red-500">{it.reason}</div>
                )}
              </div>
            </div>
          )
        })
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground text-sm">
          Chưa có giao dịch nào.
        </div>
      )}
    </div>
  )
}

function PaginationBar({
  total,
  totalPages,
  page,
  limit,
  startRow,
  endRow,
  setPage,
  setLimit,
  isLoading,
}: {
  total: number
  totalPages: number
  page: number
  limit: number
  startRow: number
  endRow: number
  setPage: (n: number) => void
  setLimit: (n: number) => void
  isLoading: boolean
}) {
  if (isLoading || total === 0) return null
  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="text-sm text-muted-foreground">
        Hiển thị {startRow}-{endRow} / {total} kết quả
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Dòng</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
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
            onClick={() => setPage(Math.max(1, page - 1))}
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
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 transition-all"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function WithdrawClient() {
  return (
    <SidebarProvider>
      <AffiliateWithdrawContent />
    </SidebarProvider>
  )
}
