"use client"

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
import { useDomainHistory, type DomainSortField } from "@/hooks/use-domain-history"

type SortDir = "asc" | "desc"

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ xử lý", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  completed: { label: "Hoàn thành", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  renew_pending: { label: "Đang gia hạn", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  cancelled: { label: "Đã hủy", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" },
  cancelled_refund: { label: "Hủy hoàn tiền", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  error_refund: { label: "Lỗi hoàn tiền", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  expired: { label: "Hết hạn", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  suspended: { label: "Tạm ngưng", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: string | null) {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatPrice(price: number) {
  return `${price.toLocaleString()}đ`
}

// ─── View ───────────────────────────────────────────────────────────────────

export function DomainHistoryClient() {
  const { collapsed } = useSidebar()
  const d = useDomainHistory()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            <PageHeader />
            <SearchBar
              value={d.searchInput}
              onChange={d.setSearchInput}
              showSpinner={d.isFetching && !d.isLoading}
            />
            <DesktopTable
              orders={d.orders}
              isLoading={d.isLoading}
              startRow={d.startRow}
              sortField={d.sortField}
              sortDir={d.sortDir}
              toggleSort={d.toggleSort}
              onEditNs={d.openEditNs}
              onRenew={d.setRenewingOrder}
            />
            <MobileCards
              orders={d.orders}
              isLoading={d.isLoading}
              onEditNs={d.openEditNs}
              onRenew={d.setRenewingOrder}
            />
            {!d.isLoading && d.total > 0 && (
              <Pagination
                page={d.page}
                setPage={d.setPage}
                limit={d.limit}
                setLimit={d.setLimit}
                total={d.total}
                totalPages={d.totalPages}
                startRow={d.startRow}
                endRow={d.endRow}
              />
            )}
          </div>
        </main>
      </div>

      {/* Edit Nameserver Modal */}
      {d.editingOrder && (
        <EditNsModal
          order={d.editingOrder}
          ns1={d.editNs1}
          setNs1={d.setEditNs1}
          ns2={d.editNs2}
          setNs2={d.setEditNs2}
          isPending={d.isSavingNs}
          onClose={() => d.setEditingOrder(null)}
          onSubmit={d.handleSubmitNs}
        />
      )}

      {/* Renew Modal */}
      {d.renewingOrder && (
        <RenewModal
          order={d.renewingOrder}
          isPending={d.isRenewing}
          onClose={() => d.setRenewingOrder(null)}
          onSubmit={d.handleConfirmRenew}
        />
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a>
          <ChevronRight />
          <span className="text-foreground font-normal">Tên miền đã mua</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Tên miền đã mua</h1>
        <p className="text-sm text-muted-foreground">Quản lý tên miền, cập nhật nameserver và theo dõi trạng thái.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a href="/domain" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 h-9">
          <PlusIcon /> Đăng ký thêm
        </a>
      </div>
    </div>
  )
}

function SearchBar({ value, onChange, showSpinner }: { value: string; onChange: (v: string) => void; showSpinner: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <SearchIcon />
          <input
            type="text"
            placeholder="Tìm kiếm tên miền..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs transition-colors placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          {showSpinner && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          )}
        </div>
      </div>
    </div>
  )
}

function DesktopTable({ orders, isLoading, startRow, sortField, sortDir, toggleSort, onEditNs, onRenew }: {
  orders: any[]
  isLoading: boolean
  startRow: number
  sortField: DomainSortField
  sortDir: SortDir
  toggleSort: (f: DomainSortField) => void
  onEditNs: (o: any) => void
  onRenew: (o: any) => void
}) {
  return (
    <div className="hidden md:block rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead><SortBtn field="domainName" current={sortField} dir={sortDir} onClick={toggleSort}>Tên miền</SortBtn></TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead><SortBtn field="totalAmount" current={sortField} dir={sortDir} onClick={toggleSort}>Giá</SortBtn></TableHead>
            <TableHead>Nameserver</TableHead>
            <TableHead><SortBtn field="expiredAt" current={sortField} dir={sortDir} onClick={toggleSort}>Hết hạn</SortBtn></TableHead>
            <TableHead><SortBtn field="createdAt" current={sortField} dir={sortDir} onClick={toggleSort}>Ngày mua</SortBtn></TableHead>
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
          ) : orders.length > 0 ? (
            orders.map((order: any, index: number) => {
              const st = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-500/10 text-gray-500" }
              const canEdit = order.status === "pending" || order.status === "completed"
              return (
                <TableRow key={order.id}>
                  <TableCell>
                    <span className="font-mono text-sm font-medium text-muted-foreground">{startRow + index}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary font-mono">
                        .{order.tldName}
                      </div>
                      <span className="text-sm font-semibold font-mono">{order.domainName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{st.label}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold">{formatPrice(order.totalAmount)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground font-mono space-y-0.5">
                      <div>NS1: {order.ns1 || "—"}</div>
                      <div>NS2: {order.ns2 || "—"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{formatDate(order.expiredAt)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="inline-flex items-center gap-1.5">
                      {canEdit && (
                        <button
                          onClick={() => onEditNs(order)}
                          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all hover:bg-accent hover:text-accent-foreground"
                          title="Đổi nameserver"
                        >
                          <EditIcon /> Đổi NS
                        </button>
                      )}
                      {order.status === "completed" && order.renewAmount > 0 && (
                        <button
                          onClick={() => onRenew(order)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 text-xs font-semibold transition-all hover:bg-primary hover:text-primary-foreground"
                          title={`Gia hạn (+1 năm) - ${formatPrice(order.renewAmount)}`}
                        >
                          <RenewIcon /> Gia hạn
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                Chưa có tên miền nào.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function MobileCards({ orders, isLoading, onEditNs, onRenew }: {
  orders: any[]
  isLoading: boolean
  onEditNs: (o: any) => void
  onRenew: (o: any) => void
}) {
  return (
    <div className="md:hidden space-y-3">
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))
      ) : orders.length > 0 ? (
        orders.map((order: any) => {
          const st = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-500/10 text-gray-500" }
          const canEdit = order.status === "pending" || order.status === "completed"
          return (
            <div key={order.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary font-mono">
                    .{order.tldName}
                  </div>
                  <span className="text-sm font-semibold font-mono">{order.domainName}</span>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{st.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Giá</p>
                  <div className="mt-0.5 font-semibold">{formatPrice(order.totalAmount)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ngày mua</p>
                  <div className="mt-0.5 font-medium">{formatDate(order.createdAt)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hết hạn</p>
                  <div className="mt-0.5 font-medium">{formatDate(order.expiredAt)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nameserver</p>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {order.ns1 || "—"} / {order.ns2 || "—"}
                  </div>
                </div>
                {(canEdit || (order.status === "completed" && order.renewAmount > 0)) && (
                  <div className="col-span-2 pt-1 flex flex-wrap gap-2">
                    {canEdit && (
                      <button
                        onClick={() => onEditNs(order)}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all hover:bg-accent hover:text-accent-foreground"
                      >
                        <EditIcon /> Đổi Nameserver
                      </button>
                    )}
                    {order.status === "completed" && order.renewAmount > 0 && (
                      <button
                        onClick={() => onRenew(order)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 text-xs font-semibold transition-all hover:bg-primary hover:text-primary-foreground"
                      >
                        <RenewIcon /> Gia hạn ({formatPrice(order.renewAmount)})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Chưa có tên miền nào.
        </div>
      )}
    </div>
  )
}

function EditNsModal({ order, ns1, setNs1, ns2, setNs2, isPending, onClose, onSubmit }: {
  order: any
  ns1: string
  setNs1: (v: string) => void
  ns2: string
  setNs2: (v: string) => void
  isPending: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={() => !isPending && onClose()}
    >
      <div className="w-full max-w-md rounded-t-2xl border bg-card p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Đổi Nameserver</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cập nhật nameserver cho <strong className="font-mono text-primary">{order.domainName}</strong>
            </p>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Nameserver 1
              <input
                type="text"
                value={ns1}
                onChange={(e) => setNs1(e.target.value.toLowerCase().trim())}
                placeholder="ns1.example.com"
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </label>
            <label className="block text-sm font-medium">
              Nameserver 2
              <input
                type="text"
                value={ns2}
                onChange={(e) => setNs2(e.target.value.toLowerCase().trim())}
                placeholder="ns2.example.com"
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={onSubmit}
              disabled={isPending || !ns1.includes(".") || !ns2.includes(".")}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Đang lưu..." : "Cập nhật"}
            </button>
          </div>
        </div>
      </div>
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
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Hiển thị {startRow}-{endRow} / {total} kết quả</span>
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
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium shadow-xs hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-all"
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
            className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium shadow-xs hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  )
}

function SortBtn({ field, current, dir, onClick, children }: {
  field: DomainSortField
  current: DomainSortField
  dir: SortDir
  onClick: (f: DomainSortField) => void
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

function ChevronRight() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
}

function PlusIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
}

function SearchIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg>
}

function EditIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
}

function RenewIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
}

function RenewModal({ order, isPending, onClose, onSubmit }: {
  order: any
  isPending: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const renewYears = (order.renewCount || 0) + 1
  const currentExpiry = order.expiredAt ? formatDate(order.expiredAt) : "—"
  const newExpiry = order.expiredAt
    ? (() => {
        const d = new Date(order.expiredAt)
        d.setFullYear(d.getFullYear() + 1)
        return formatDate(d.toISOString())
      })()
    : "—"

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={() => !isPending && onClose()}
    >
      <div className="w-full max-w-md rounded-t-2xl border bg-card p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <RenewIcon />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground">Gia hạn tên miền</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gia hạn <strong className="font-mono text-foreground">{order.domainName}</strong> thêm 1 năm. Thanh toán bằng số dư ví.
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hết hạn hiện tại</span>
              <span className="font-mono">{currentExpiry}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hết hạn sau gia hạn</span>
              <span className="font-mono font-semibold text-foreground">{newExpiry}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Số lần đã gia hạn</span>
              <span className="font-mono">{order.renewCount || 0}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Phí gia hạn (lần {renewYears})</span>
              <span className="font-bold text-primary text-base">{formatPrice(order.renewAmount)}</span>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Sau khi xác nhận, hệ thống sẽ trừ số dư ngay và gọi API gia hạn với nhà cung cấp. Nếu đăng ký qua Spaceship, quá trình có thể mất vài phút để hoàn tất; số dư sẽ tự hoàn nếu nhà cung cấp từ chối.
          </p>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={onSubmit}
              disabled={isPending}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Đang xử lý..." : `Xác nhận · ${formatPrice(order.renewAmount)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}



