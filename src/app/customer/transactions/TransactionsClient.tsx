"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { useTransactions } from "@/hooks/use-transactions"

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function formatMoney(n: number) {
  return n.toLocaleString() + "đ"
}

export function TransactionsClient() {
  const { collapsed } = useSidebar()
  const o = useTransactions()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            {/* ─── Header + Breadcrumb ─── */}
            <div className="space-y-1">
              <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a>
                <ChevronRight />
                <span className="text-foreground font-normal">Lịch sử giao dịch</span>
              </nav>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Lịch sử giao dịch</h1>
              <p className="text-sm text-muted-foreground">Biến động số dư tài khoản: nạp tiền, mua dịch vụ, hoàn tiền.</p>
            </div>

            {/* ─── Search ─── */}
            <div className="flex items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Tìm kiếm giao dịch..."
                  value={o.searchInput}
                  onChange={(e) => o.setSearchInput(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs transition-colors placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                />
                {o.isFetching && !o.isLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                )}
              </div>
            </div>

            {/* ─── Desktop Table ─── */}
            <div className="hidden md:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>Nội dung</TableHead>
                    <TableHead className="w-[180px]">Thời gian</TableHead>
                    <TableHead className="w-[130px] text-right">Biến động</TableHead>
                    <TableHead className="w-[130px] text-right">Số dư</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {o.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : o.items.length > 0 ? (
                    o.items.map((tx: any, idx: number) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <span className="font-mono text-sm font-medium text-muted-foreground">{o.startRow + idx}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{tx.content}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(tx.createdAt)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-semibold whitespace-nowrap ${tx.moneyChange > 0 ? "text-green-500" : "text-red-500"}`}>
                            {tx.moneyChange > 0 ? "+" : ""}{formatMoney(tx.moneyChange)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-medium tabular-nums whitespace-nowrap">{formatMoney(tx.moneyAfter)}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Chưa có giao dịch nào.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ─── Mobile Cards ─── */}
            <div className="md:hidden space-y-3">
              {o.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                ))
              ) : o.items.length > 0 ? (
                o.items.map((tx: any) => (
                  <div key={tx.id} className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex-1 text-sm font-medium leading-snug break-words" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                        {tx.content}
                      </p>
                      <span className={`shrink-0 text-sm font-semibold ${tx.moneyChange > 0 ? "text-green-500" : "text-red-500"}`}>
                        {tx.moneyChange > 0 ? "+" : ""}{formatMoney(tx.moneyChange)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(tx.createdAt)}</span>
                      <span className="font-medium text-foreground">Số dư: {formatMoney(tx.moneyAfter)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                  Chưa có giao dịch nào.
                </div>
              )}
            </div>

            {/* ─── Pagination ─── */}
            {!o.isLoading && o.total > 0 && (
              <Pagination
                page={o.page} setPage={o.setPage}
                limit={o.limit} setLimit={o.setLimit}
                total={o.total} totalPages={o.totalPages}
                startRow={o.startRow} endRow={o.endRow}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Shared sub-components ──────────────────────────────────────────────────

function Pagination({ page, setPage, limit, setLimit, total, totalPages, startRow, endRow }: {
  page: number; setPage: (p: number | ((prev: number) => number)) => void
  limit: number; setLimit: (n: number) => void
  total: number; totalPages: number; startRow: number; endRow: number
}) {
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

function ChevronRight() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
}

function SearchIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg>
}
