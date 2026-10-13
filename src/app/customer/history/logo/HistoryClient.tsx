"use client"

import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
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
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Download, ExternalLink, X } from "lucide-react"
import { useLogoHistory, type LogoSortField } from "@/hooks/use-logo-history"
import { getManualOrderStatusBadge, MANUAL_ORDER_STATUSES } from "@/lib/order-status"

type SortDir = "asc" | "desc"

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  ...MANUAL_ORDER_STATUSES.map((s) => ({
    value: s,
    label: getManualOrderStatusBadge(s).label,
  })),
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(input: any) {
  if (!input) return "—"
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatPrice(n: number | undefined | null) {
  return new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ"
}

// ─── View ───────────────────────────────────────────────────────────────────

export function LogoHistoryClient() {
  const { collapsed } = useSidebar()
  const l = useLogoHistory()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            <PageHeader />
            <SearchFilters
              searchInput={l.searchInput}
              setSearchInput={l.setSearchInput}
              statusFilter={l.statusFilter}
              setStatusFilter={l.setStatusFilter}
              isFetching={l.isFetching}
              isLoading={l.isLoading}
            />
            <DesktopTable
              items={l.items}
              isLoading={l.isLoading}
              startRow={l.startRow}
              sortField={l.sortField}
              sortDir={l.sortDir}
              toggleSort={l.toggleSort}
              onCancel={l.setCancellingOrder}
              onDownload={l.handleDownload}
              isDownloading={l.isDownloading}
              downloadingId={l.downloadingId}
            />
            <MobileCards
              items={l.items}
              isLoading={l.isLoading}
              onCancel={l.setCancellingOrder}
              onDownload={l.handleDownload}
              isDownloading={l.isDownloading}
              downloadingId={l.downloadingId}
            />
            {!l.isLoading && l.total > 0 && (
              <Pagination
                page={l.page}
                setPage={l.setPage}
                limit={l.limit}
                setLimit={l.setLimit}
                total={l.total}
                totalPages={l.totalPages}
                startRow={l.startRow}
                endRow={l.endRow}
              />
            )}
          </div>
        </main>
      </div>

      {/* Cancel ConfirmDialog */}
      <ConfirmDialog
        open={!!l.cancellingOrder}
        onOpenChange={(o) => { if (!o) l.setCancellingOrder(null) }}
        title="Xác nhận hủy đơn"
        description="Đơn sẽ bị hủy và tiền sẽ được hoàn lại vào số dư. Hành động này không thể hoàn tác."
        variant="destructive"
        confirmText="Xác nhận hủy"
        cancelText="Giữ đơn"
        isPending={l.isCancelling}
        onConfirm={l.handleConfirmCancel}
      >
        {l.cancellingOrder && (
          <div className="rounded-md bg-muted/40 border p-3 text-xs space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Logo</span>
              <span className="font-medium text-right line-clamp-1 max-w-[60%]">{l.cancellingOrder.logoTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shop</span>
              <span className="font-medium">{l.cancellingOrder.shopName}</span>
            </div>
            <div className="flex justify-between font-bold pt-1.5 border-t mt-1.5">
              <span>Tiền hoàn lại</span>
              <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatPrice(l.cancellingOrder.price)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          <ChevronRight />
          <span className="text-foreground font-normal">Logo đã thuê</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Logo đã thuê</h1>
        <p className="text-sm text-muted-foreground">Quản lý các logo đã thuê theo lượt. Tải file gốc sau khi designer bàn giao.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/create-logo" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 h-9 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90">
          <PlusIcon /> Thuê thêm
        </Link>
      </div>
    </div>
  )
}

function SearchFilters({ searchInput, setSearchInput, statusFilter, setStatusFilter, isFetching, isLoading }: {
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
        <SearchIcon />
        <input
          type="text"
          placeholder="Tìm theo tên logo hoặc shop..."
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

function DesktopTable({ items, isLoading, startRow, sortField, sortDir, toggleSort, onCancel, onDownload, isDownloading, downloadingId }: {
  items: any[]
  isLoading: boolean
  startRow: number
  sortField: LogoSortField
  sortDir: SortDir
  toggleSort: (f: LogoSortField) => void
  onCancel: (o: any) => void
  onDownload: (id: string) => void
  isDownloading: boolean
  downloadingId?: string
}) {
  return (
    <div className="hidden md:block rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead>Ảnh</TableHead>
            <TableHead><SortBtn field="logoTitle" current={sortField} dir={sortDir} onClick={toggleSort}>Tên Logo</SortBtn></TableHead>
            <TableHead><SortBtn field="price" current={sortField} dir={sortDir} onClick={toggleSort}>Giá</SortBtn></TableHead>
            <TableHead>Tên shop</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead><SortBtn field="createdAt" current={sortField} dir={sortDir} onClick={toggleSort}>Ngày thuê</SortBtn></TableHead>
            <TableHead className="text-end">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : items.length > 0 ? (
            items.map((o: any, index: number) => (
              <TableRow key={o.id}>
                <TableCell>
                  <span className="font-mono text-sm font-medium text-muted-foreground">{startRow + index}</span>
                </TableCell>
                <TableCell>
                  <div className="h-12 w-12 rounded-md overflow-hidden bg-muted border shrink-0">
                    {o.logoImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.logoImage} alt={o.logoTitle} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">No img</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-[200px] max-w-[320px]">
                    <Link href={`/create-logo/${o.logoSlug}`} className="text-sm font-medium hover:text-primary transition-colors line-clamp-2" title={o.logoTitle}>
                      {o.logoTitle}
                    </Link>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-semibold">{formatPrice(o.price)}</span>
                </TableCell>
                <TableCell>
                  <div className="min-w-[140px] max-w-[220px]">
                    <p className="text-sm font-medium truncate" title={o.shopName}>{o.shopName}</p>
                    {o.customNote && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={o.customNote}>{o.customNote}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={o.status} /></TableCell>
                <TableCell>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(o.createdAt)}</div>
                </TableCell>
                <TableCell className="text-end">
                  <RowActions
                    order={o}
                    onCancel={onCancel}
                    onDownload={onDownload}
                    isDownloading={isDownloading && downloadingId === o.id}
                  />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                Bạn chưa thuê logo nào.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function MobileCards({ items, isLoading, onCancel, onDownload, isDownloading, downloadingId }: {
  items: any[]
  isLoading: boolean
  onCancel: (o: any) => void
  onDownload: (id: string) => void
  isDownloading: boolean
  downloadingId?: string
}) {
  return (
    <div className="md:hidden space-y-3">
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex gap-3">
              <Skeleton className="h-16 w-16 rounded shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-9 w-full" />
          </div>
        ))
      ) : items.length > 0 ? (
        items.map((o: any) => (
          <div key={o.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex gap-3">
              <div className="h-16 w-16 rounded-md overflow-hidden bg-muted border shrink-0">
                {o.logoImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.logoImage} alt={o.logoTitle} loading="lazy" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/create-logo/${o.logoSlug}`} className="font-medium text-sm line-clamp-2 hover:text-primary">{o.logoTitle}</Link>
                <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Giá</p>
                <div className="mt-0.5 font-semibold">{formatPrice(o.price)}</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Trạng thái</p>
                <div className="mt-0.5"><StatusBadge status={o.status} /></div>
              </div>
            </div>
            <div className="text-sm">
              <p className="text-xs text-muted-foreground">Tên shop</p>
              <p className="mt-0.5 font-medium">{o.shopName}</p>
              {o.customNote && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{o.customNote}</p>
              )}
            </div>
            {o.status === "pending" ? (
              <button
                onClick={() => onCancel(o)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20 h-9 text-sm font-medium hover:bg-rose-500/20 transition-all"
              >
                <X className="h-4 w-4" /> Hủy đơn + Hoàn tiền
              </button>
            ) : (
              <button
                onClick={() => onDownload(o.id)}
                disabled={(isDownloading && downloadingId === o.id) || o.status !== "completed"}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground h-9 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                <Download className="h-4 w-4" /> Tải file gốc
              </button>
            )}
          </div>
        ))
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Bạn chưa thuê logo nào.
        </div>
      )}
    </div>
  )
}

function RowActions({ order, onCancel, onDownload, isDownloading }: {
  order: any
  onCancel: (o: any) => void
  onDownload: (id: string) => void
  isDownloading: boolean
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={`/create-logo/${order.logoSlug}`}
        className="inline-flex items-center justify-center rounded-md border bg-background h-8 px-2.5 text-xs font-medium hover:bg-accent transition-all"
        title="Xem chi tiết"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
      {order.status === "pending" ? (
        <button
          onClick={() => onCancel(order)}
          className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20 px-2.5 h-8 text-xs font-medium hover:bg-rose-500/20 transition-all"
          title="Hủy đơn + hoàn tiền"
        >
          <X className="h-3.5 w-3.5" /> Hủy
        </button>
      ) : (
        <button
          onClick={() => onDownload(order.id)}
          disabled={isDownloading || order.status !== "completed"}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 px-2.5 h-8 text-xs font-medium hover:bg-primary/20 disabled:opacity-50 disabled:pointer-events-none transition-all"
        >
          <Download className="h-3.5 w-3.5" /> Tải
        </button>
      )}
    </div>
  )
}

function Pagination({ page, setPage, limit, setLimit, total, totalPages, startRow, endRow }: {
  page: number
  setPage: (p: number | ((prev: number) => number)) => void
  limit: number
  setLimit: (n: number) => void
  total: number
  totalPages: number
  startRow: number
  endRow: number
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="text-sm text-muted-foreground">
        Hiển thị {startRow}-{endRow} / {total} đơn
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Dòng</span>
          <SelectCustom
            value={String(limit)}
            onValueChange={(v) => setLimit(Number(v))}
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
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
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
                    onClick={() => setPage(p)}
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
            onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
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

function SortBtn({ field, current, dir, onClick, children }: {
  field: LogoSortField
  current: LogoSortField
  dir: SortDir
  onClick: (f: LogoSortField) => void
  children: React.ReactNode
}) {
  return (
    <button onClick={() => onClick(field)} className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors">
      {children}
      <SortIcon active={current === field} dir={current === field ? dir : undefined} />
    </button>
  )
}

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

function StatusBadge({ status }: { status: string }) {
  const conf = getManualOrderStatusBadge(status)
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${conf.color}`}>
      {conf.label}
    </span>
  )
}

function ChevronRight() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
}

function PlusIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg>
}



