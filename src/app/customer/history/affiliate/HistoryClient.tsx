"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { IconSearch } from "@/components/icons"
import { useAffiliateHistory } from "@/hooks/use-affiliate"

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

// ─── View ───────────────────────────────────────────────────────────────────

export function AffiliateHistoryClient() {
  const { collapsed } = useSidebar()
  const h = useAffiliateHistory()

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

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo nội dung..."
                    value={h.searchInput}
                    onChange={(e) => h.setSearchInput(e.target.value)}
                    className="h-9 pl-9"
                  />
                </div>
              </div>

              <DesktopTable
                items={h.items}
                isLoading={h.isLoading}
                startRow={h.startRow}
              />

              <MobileCards items={h.items} isLoading={h.isLoading} />

              <PaginationBar
                total={h.total}
                totalPages={h.totalPages}
                page={h.page}
                limit={h.limit}
                startRow={h.startRow}
                endRow={h.endRow}
                setPage={h.setPage}
                setLimit={h.setLimit}
                isLoading={h.isLoading}
              />
            </div>
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
        <a href="/customer/affiliate" className="hover:text-foreground transition-colors">
          Tiếp thị liên kết
        </a>
        <span>/</span>
        <span className="text-foreground font-medium">Lịch sử hoa hồng</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight">Lịch sử hoa hồng</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        Tất cả khoản hoa hồng nhận được từ chương trình giới thiệu.
      </p>
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
            <TableHead>Nội dung</TableHead>
            <TableHead className="text-right">Hoa hồng cũ</TableHead>
            <TableHead className="text-right">Thay đổi</TableHead>
            <TableHead className="text-right">Hoa hồng mới</TableHead>
            <TableHead>Thời gian</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              </TableRow>
            ))
          ) : items.length > 0 ? (
            items.map((it: any, i: number) => (
              <TableRow key={it.id}>
                <TableCell>
                  <span className="font-mono text-sm text-muted-foreground">
                    {startRow + i}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{it.content}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground tabular-nums block text-right">
                    {formatMoney(it.moneyBefore)}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`text-sm font-semibold tabular-nums block text-right ${
                      it.moneyChange >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {it.moneyChange >= 0 ? "+" : ""}
                    {formatMoney(it.moneyChange)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-semibold tabular-nums block text-right">
                    {formatMoney(it.moneyAfter)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(it.createdAt)}
                  </span>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                Chưa có hoa hồng nào.
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
            <Skeleton className="h-4 w-48" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))
      ) : items.length > 0 ? (
        items.map((it: any) => (
          <div key={it.id} className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-sm font-medium">{it.content}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Hoa hồng cũ</p>
                <p className="mt-0.5 text-muted-foreground tabular-nums">
                  {formatMoney(it.moneyBefore)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Thay đổi</p>
                <p
                  className={`mt-0.5 font-semibold tabular-nums ${
                    it.moneyChange >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {it.moneyChange >= 0 ? "+" : ""}
                  {formatMoney(it.moneyChange)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hoa hồng mới</p>
                <p className="mt-0.5 font-semibold tabular-nums">
                  {formatMoney(it.moneyAfter)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Thời gian</p>
                <p className="mt-0.5 text-xs">{formatDate(it.createdAt)}</p>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground text-sm">
          Chưa có hoa hồng nào.
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



