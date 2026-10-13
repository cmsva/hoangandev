"use client"

import { useState } from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
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
import { SelectCustom } from "@/components/ui/select-custom"
import { ExternalLink, Globe, Sparkles, Eye, EyeOff, Copy, Lock, RefreshCw, X } from "lucide-react"
import { useWebsiteHistory } from "@/hooks/use-website-history"
import { DeployNsDialog } from "@/components/website/deploy-ns-dialog"
import {
  getServiceOrderStatusBadge,
  SERVICE_ORDER_STATUSES,
} from "@/lib/order-status"

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  ...SERVICE_ORDER_STATUSES.map((s) => ({
    value: s,
    label: getServiceOrderStatusBadge(s).label,
  })),
]

function formatDateTime(input: any) {
  if (!input) return "—"
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatExpiry(timestamp: number) {
  if (!timestamp || timestamp <= 0) return "—"
  const d = new Date(timestamp * 1000)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatPrice(n: number | undefined | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ"
}

export function WebsiteHistoryClient() {
  const { collapsed } = useSidebar()
  const w = useWebsiteHistory()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            <HeaderSection />
            <SearchFilters
              searchInput={w.searchInput}
              setSearchInput={w.setSearchInput}
              statusFilter={w.statusFilter}
              setStatusFilter={w.setStatusFilter}
              isFetching={w.isFetching}
              isLoading={w.isLoading}
            />

            {/* Desktop Table */}
            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DỊCH VỤ</TableHead>
                    <TableHead>TÀI KHOẢN</TableHead>
                    <TableHead>MẬT KHẨU</TableHead>
                    <TableHead>TỔNG TIỀN</TableHead>
                    <TableHead>TRẠNG THÁI</TableHead>
                    <TableHead>HẾT HẠN</TableHead>
                    <TableHead>NGÀY TẠO</TableHead>
                    <TableHead className="text-end">THAO TÁC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {w.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : w.items.length > 0 ? (
                    w.items.map((o: any) => (
                      <OrderRow key={o.id} order={o} onShowNs={w.openNsDialog} onRenew={w.openRenew} />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        Bạn chưa thuê website nào.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {w.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))
              ) : w.items.length > 0 ? (
                w.items.map((o: any) => <OrderCard key={o.id} order={o} onShowNs={w.openNsDialog} onRenew={w.openRenew} />)
              ) : (
                <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                  Bạn chưa thuê website nào.
                </div>
              )}
            </div>

            {!w.isLoading && w.total > 0 && (
              <Pagination
                page={w.page}
                totalPages={w.totalPages}
                limit={w.limit}
                onPageChange={w.setPage}
                onLimitChange={w.setLimit}
                start={w.startRow}
                end={w.endRow}
                total={w.total}
              />
            )}
          </div>
        </main>
      </div>

      {w.nsDialogOrder && (
        <DeployNsDialog
          info={{
            domainName: w.nsDialogOrder.domainName,
            status: w.nsDialogOrder.status,
            nameServers: w.nsDialogOrder.nameServers || [],
            deployCompletedAt: w.nsDialogOrder.deployCompletedAt,
          }}
          onClose={w.closeNsDialog}
        />
      )}

      {w.renewingOrder && (
        <RenewDialog
          order={w.renewingOrder}
          months={w.renewMonths}
          setMonths={w.setRenewMonths}
          cost={w.renewCost}
          isPending={w.isRenewing}
          onClose={() => w.setRenewingOrder(null)}
          onConfirm={w.handleSubmitRenew}
        />
      )}
    </div>
  )
}

// ─── Renew dialog ──────────────────────────────────────────────────────────
const MONTH_OPTIONS = ["1", "3", "6", "12", "24"]

function RenewDialog({
  order, months, setMonths, cost, isPending, onClose, onConfirm,
}: {
  order: any
  months: string
  setMonths: (v: string) => void
  cost: number
  isPending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const pricePerMonth = Number(order.priceExtend) || 0
  const noPrice = pricePerMonth <= 0
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" /> Gia hạn website
            </h2>
            <p className="text-sm text-muted-foreground line-clamp-1" title={order.serviceName}>{order.serviceName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          <span className="font-mono truncate">{order.domainName}</span>
        </div>

        {noPrice ? (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            Đơn này chưa cấu hình phí gia hạn. Vui lòng liên hệ hỗ trợ.
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium">Số tháng gia hạn</label>
              <div className="grid grid-cols-5 gap-2">
                {MONTH_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonths(m)}
                    className={`h-9 rounded-md border text-sm font-semibold transition-all ${
                      months === m
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div className="text-sm">
                <p className="text-muted-foreground">Phí gia hạn</p>
                <p className="text-xs text-muted-foreground/70">{formatPrice(pricePerMonth)} × {months} tháng</p>
              </div>
              <span className="text-lg font-bold text-primary">{formatPrice(cost)}</span>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={onClose}
                disabled={isPending}
                className="flex-1 h-10 rounded-md border bg-background text-sm font-medium hover:bg-accent disabled:opacity-50 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={onConfirm}
                disabled={isPending}
                className="flex-1 h-10 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all inline-flex items-center justify-center gap-1.5"
              >
                {isPending ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Xác nhận
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function HeaderSection() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          <Chevron />
          <span className="text-foreground font-normal">Website đã tạo</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Website đã tạo</h1>
        <p className="text-sm text-muted-foreground">Quản lý đơn website + xem credentials shop trực tiếp.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/create-website"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 h-9 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
          Thuê thêm
        </Link>
      </div>
    </div>
  )
}

function Chevron() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function SearchFilters({
  searchInput,
  setSearchInput,
  statusFilter,
  setStatusFilter,
  isFetching,
  isLoading,
}: {
  searchInput: string
  setSearchInput: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  isFetching: boolean
  isLoading: boolean
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative max-w-sm flex-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg>
        <input
          type="text"
          placeholder="Tìm theo mẫu hoặc tên miền..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs transition-colors placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        {isFetching && !isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        )}
      </div>
      <SelectCustom
        value={statusFilter}
        onValueChange={setStatusFilter}
        className="w-full sm:w-[200px]"
        placeholder="Trạng thái"
        options={STATUS_FILTER_OPTIONS}
      />
    </div>
  )
}

function OrderRow({ order: o, onShowNs, onRenew }: { order: any; onShowNs: (o: any) => void; onRenew: (o: any) => void }) {
  const hasNs = Array.isArray(o.nameServers) && o.nameServers.length > 0
  const canRenew = (o.status === "active" || o.status === "expired") && (Number(o.priceExtend) || 0) > 0
  return (
    <TableRow>
      {/* Dịch vụ — service name + domain in 1 cell */}
      <TableCell>
        <div className="min-w-[200px] max-w-[260px]">
          <Link
            href={`/create-website/${o.serviceSlug}`}
            className="text-sm font-medium hover:text-primary transition-colors line-clamp-1"
            title={o.serviceName}
          >
            {o.serviceName}
          </Link>
          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
            <Globe className="h-2.5 w-2.5 shrink-0" />
            <span className="font-mono truncate" title={o.domainName}>{o.domainName}</span>
            {o.domainNew && (
              <span className="inline-flex items-center text-amber-600 dark:text-amber-400 font-medium ml-1">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </div>
      </TableCell>

      {/* Tài khoản */}
      <TableCell>
        <CredentialCell value={o.shopAccount} />
      </TableCell>

      {/* Mật khẩu */}
      <TableCell>
        <CredentialCell value={o.shopPassword} masked />
      </TableCell>

      {/* Tổng tiền */}
      <TableCell>
        <span className="text-sm font-semibold whitespace-nowrap">{formatPrice(o.total)}</span>
      </TableCell>

      {/* Trạng thái */}
      <TableCell>
        <StatusBadge status={o.status} />
      </TableCell>

      {/* Hết hạn */}
      <TableCell>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatExpiry(o.expired)}</span>
      </TableCell>

      {/* Ngày tạo */}
      <TableCell>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(o.createdAt)}</span>
      </TableCell>

      {/* Thao tác */}
      <TableCell className="text-end">
        <div className="inline-flex items-center gap-1.5">
          {canRenew && (
            <button
              type="button"
              onClick={() => onRenew(o)}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-primary-foreground"
              title="Gia hạn website"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Gia hạn
            </button>
          )}
          {hasNs ? (
            <button
              type="button"
              onClick={() => onShowNs(o)}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-all hover:bg-emerald-500 hover:text-white"
              title="Xem nameserver cố định"
            >
              <Globe className="h-3.5 w-3.5" /> Xem NS
            </button>
          ) : (
            <Link
              href={`/create-website/${o.serviceSlug}`}
              className="inline-flex items-center justify-center rounded-md border bg-background h-8 px-2.5 text-xs font-medium hover:bg-accent transition-all"
              title="Xem mẫu"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function OrderCard({ order: o, onShowNs, onRenew }: { order: any; onShowNs: (o: any) => void; onRenew: (o: any) => void }) {
  const hasNs = Array.isArray(o.nameServers) && o.nameServers.length > 0
  const canRenew = (o.status === "active" || o.status === "expired") && (Number(o.priceExtend) || 0) > 0
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex gap-3">
        <div className="h-16 w-20 rounded-md overflow-hidden bg-muted border shrink-0">
          {o.serviceImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.serviceImage} alt={o.serviceName} loading="lazy" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/create-website/${o.serviceSlug}`} className="font-medium text-sm line-clamp-2 hover:text-primary">
            {o.serviceName}
          </Link>
          <div className="mt-1 flex items-center gap-1 text-xs">
            <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-mono truncate">{o.domainName}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Tổng</p>
          <div className="mt-0.5 font-semibold">{formatPrice(o.total)}</div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Trạng thái</p>
          <div className="mt-0.5"><StatusBadge status={o.status} /></div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tháng</p>
          <div className="mt-0.5 font-medium">{o.month} tháng</div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Hết hạn</p>
          <div className="mt-0.5 font-medium">{formatExpiry(o.expired)}</div>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Tài khoản admin
          </p>
          <CredentialCell value={o.shopAccount} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Mật khẩu
          </p>
          <CredentialCell value={o.shopPassword} masked />
        </div>
      </div>

      {hasNs && (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          <p className="font-semibold">NS cố định</p>
          <p className="mt-1">Domain cần trỏ về NS cố định này. Cron sẽ tự tạo Cloudflare/DNS và aaPanel, không cần bấm check NS.</p>
          <button type="button" onClick={() => onShowNs(o)} className="mt-2 inline-flex items-center gap-1 h-8 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white">
            <Globe className="h-3.5 w-3.5" /> Xem nameserver
          </button>
        </div>
      )}



      {canRenew && (
        <button
          type="button"
          onClick={() => onRenew(o)}
          className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-md border border-primary/30 bg-primary/10 text-sm font-semibold text-primary transition-all hover:bg-primary hover:text-primary-foreground"
        >
          <RefreshCw className="h-4 w-4" /> Gia hạn
        </button>
      )}

      {o.domainNew && (
        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Mua mới {o.domainTldName ? `.${o.domainTldName}` : ""} (+{formatPrice(o.domainTldPrice)})
        </div>
      )}
      {o.couponCode && (
        <div className="text-xs">
          <span className="text-muted-foreground">Mã: </span>
          <span className="font-mono font-bold">{o.couponCode}</span>
          <span className="text-emerald-600 ml-1">(−{formatPrice(o.couponDiscountAmount)})</span>
        </div>
      )}
    </div>
  )
}

/**
 * Cell hiển thị credential trong table — có toggle mask + copy.
 * Mặc định hiện plaintext cho username, mask cho password.
 */
function CredentialCell({ value, masked: defaultMasked = false }: { value: string | null; masked?: boolean }) {
  const [show, setShow] = useState(!defaultMasked)

  if (!value) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const display = show ? value : "•".repeat(Math.min(value.length, 12))

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(value)
    toast.success("Đã copy")
  }

  return (
    <div className="flex items-center gap-1 max-w-[180px]">
      <code className="flex-1 font-mono text-xs bg-muted/50 rounded px-1.5 py-1 truncate" title={show ? value : "Đã ẩn"}>
        {display}
      </code>
      <button
        onClick={(e) => { e.stopPropagation(); setShow(!show) }}
        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        title={show ? "Ẩn" : "Hiện"}
      >
        {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        title="Copy"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const conf = getServiceOrderStatusBadge(status)
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${conf.color}`}>
      {conf.label}
    </span>
  )
}

function Pagination({
  page, totalPages, limit, onPageChange, onLimitChange, start, end, total,
}: {
  page: number
  totalPages: number
  limit: number
  onPageChange: (p: number) => void
  onLimitChange: (n: number) => void
  start: number
  end: number
  total: number
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="text-sm text-muted-foreground">
        Hiển thị {start}-{end} / {total} đơn
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Dòng</span>
          <SelectCustom
            value={String(limit)}
            onValueChange={(v) => onLimitChange(Number(v))}
            size="sm"
            className="w-[80px]"
            options={[
              { value: "5", label: "5" },
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "50", label: "50" },
            ]}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-all"
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
                    onClick={() => onPageChange(p)}
                    className={`inline-flex items-center justify-center rounded-md h-8 min-w-8 px-3 text-sm font-medium transition-all ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "border bg-background hover:bg-accent"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
          </span>
          <span className="sm:hidden text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  )
}


