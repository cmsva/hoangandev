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
import { useOrderHistory } from "@/hooks/use-order-history"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatPrice(price: number) {
  if (price === 0) return "Miễn phí"
  return `${price.toLocaleString()}đ`
}

// ─── View ───────────────────────────────────────────────────────────────────

export function OrderHistoryClient() {
  const { collapsed } = useSidebar()
  const o = useOrderHistory()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            <PageHeader />
            <SearchBar
              value={o.searchInput}
              onChange={o.setSearchInput}
              showSpinner={o.isFetching && !o.isLoading}
            />
            <DesktopTable
              orders={o.orders}
              isLoading={o.isLoading}
              startRow={o.startRow}
              sortField={o.sortField}
              sortDir={o.sortDir}
              toggleSort={o.toggleSort}
              onDownload={o.handleDownload}
              isDownloading={o.isDownloading}
              downloadingId={o.downloadingId}
            />
            <MobileCards
              orders={o.orders}
              isLoading={o.isLoading}
              onDownload={o.handleDownload}
              isDownloading={o.isDownloading}
              downloadingId={o.downloadingId}
            />
            {!o.isLoading && o.total > 0 && (
              <Pagination
                page={o.page}
                setPage={o.setPage}
                limit={o.limit}
                setLimit={o.setLimit}
                total={o.total}
                totalPages={o.totalPages}
                startRow={o.startRow}
                endRow={o.endRow}
              />
            )}
          </div>
        </main>
      </div>
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
          <ChevronRightIcon />
          <span className="text-foreground font-normal">Mã nguồn đã mua</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mã nguồn đã mua</h1>
        <p className="text-sm text-muted-foreground">Quản lý và tải về các mã nguồn bạn đã mua.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="/source-code"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 h-9"
        >
          <PlusIcon /> Mua thêm
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
            placeholder="Tìm kiếm đơn hàng..."
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

type SortField = "productTitle" | "totalPrice" | "orderDate"
type SortDir = "asc" | "desc"

function DesktopTable({
  orders, isLoading, startRow, sortField, sortDir, toggleSort, onDownload, isDownloading, downloadingId,
}: {
  orders: any[]
  isLoading: boolean
  startRow: number
  sortField: SortField
  sortDir: SortDir
  toggleSort: (f: SortField) => void
  onDownload: (orderId: string) => void
  isDownloading: boolean
  downloadingId?: string
}) {
  return (
    <div className="hidden md:block rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead>
              <button onClick={() => toggleSort("productTitle")} className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors">
                Sản phẩm
                <SortIcon active={sortField === "productTitle"} dir={sortField === "productTitle" ? sortDir : undefined} />
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => toggleSort("totalPrice")} className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors">
                Giá
                <SortIcon active={sortField === "totalPrice"} dir={sortField === "totalPrice" ? sortDir : undefined} />
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => toggleSort("orderDate")} className="inline-flex items-center gap-1 hover:text-foreground -ms-2 px-2 py-1 rounded-md transition-colors">
                Ngày mua
                <SortIcon active={sortField === "orderDate"} dir={sortField === "orderDate" ? sortDir : undefined} />
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
                <TableCell><div className="flex items-center gap-2.5"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-40" /></div></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-7 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : orders.length > 0 ? (
            orders.map((order: any, index: number) => (
              <TableRow key={order.id} className="cursor-pointer">
                <TableCell>
                  <span className="font-mono text-sm font-medium text-muted-foreground">{startRow + index}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    {order.productThumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={order.productThumbnail} alt="" className="h-8 w-8 rounded-lg object-cover border shrink-0" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {order.productTitle.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <a href={`/source-code/${order.productSlug}`} className="text-sm font-medium hover:text-primary transition-colors">
                      {order.productTitle}
                    </a>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-sm font-semibold ${order.totalPrice === 0 ? "text-green-500" : ""}`}>
                    {formatPrice(order.totalPrice)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{formatDate(order.orderDate)}</span>
                </TableCell>
                <TableCell className="text-end">
                  <DownloadButton
                    orderId={order.id}
                    onClick={onDownload}
                    isPending={isDownloading && downloadingId === order.id}
                  />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                Chưa có đơn hàng nào.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function MobileCards({ orders, isLoading, onDownload, isDownloading, downloadingId }: {
  orders: any[]
  isLoading: boolean
  onDownload: (orderId: string) => void
  isDownloading: boolean
  downloadingId?: string
}) {
  return (
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
      ) : orders.length > 0 ? (
        orders.map((order: any) => (
          <div key={order.id} className="rounded-lg border bg-card p-4 space-y-3 cursor-pointer active:bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {order.productThumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={order.productThumbnail} alt="" className="h-8 w-8 rounded-lg object-cover border shrink-0" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {order.productTitle.charAt(0).toUpperCase()}
                  </div>
                )}
                <a href={`/source-code/${order.productSlug}`} className="text-sm font-medium hover:text-primary transition-colors line-clamp-1">
                  {order.productTitle}
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Giá</p>
                <div className={`mt-0.5 font-semibold ${order.totalPrice === 0 ? "text-green-500" : ""}`}>
                  {formatPrice(order.totalPrice)}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ngày mua</p>
                <div className="mt-0.5 font-medium">{formatDate(order.orderDate)}</div>
              </div>
              <div className="col-span-2 pt-1">
                <DownloadButton
                  orderId={order.id}
                  onClick={onDownload}
                  isPending={isDownloading && downloadingId === order.id}
                />
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Chưa có đơn hàng nào.
        </div>
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
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
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
            onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
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

function DownloadButton({ orderId, onClick, isPending }: { orderId: string; onClick: (id: string) => void; isPending: boolean }) {
  return (
    <button
      onClick={() => onClick(orderId)}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? <SpinnerIcon /> : <DownloadIcon />}
      Tải về
    </button>
  )
}

// ─── Inline icon components (SVG) ───────────────────────────────────────────

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

function ChevronRightIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
}

function PlusIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
}

function SearchIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg>
}

function DownloadIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
}

function SpinnerIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
}



