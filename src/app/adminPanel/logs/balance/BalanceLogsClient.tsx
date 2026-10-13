"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
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
import { IconWallet } from "@/components/icons"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(n: number | null | undefined) {
  const num = Number(n)
  return new Intl.NumberFormat("vi-VN").format(Number.isFinite(num) ? num : 0) + "đ"
}

function formatDateTime(input: any) {
  if (!input) return "—"
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function AdminBalanceLogsClient() {
  const trpc = useTRPC()

  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Debounce 350ms
  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.admin.getBalanceLogs.queryOptions({
      page,
      limit,
      keyword: keyword || undefined,
    })
  ) as { data: any; isLoading: boolean; isFetching: boolean }

  const items: any[] = data?.items ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb + Title ─── */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">
            Admin
          </a>
          <ChevronRight />
          <span className="text-foreground font-normal">Biến động số dư</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
            <IconWallet size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nhật ký biến động số dư</h1>
            <p className="text-sm text-muted-foreground">
              Theo dõi tất cả thay đổi số dư của thành viên (cộng/trừ ví).
            </p>
          </div>
        </div>
      </div>

      {/* ─── Search ─── */}
      <div className="relative max-w-sm">
        <SearchIcon />
        <input
          type="text"
          placeholder="Tìm theo username, nội dung..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs transition-colors placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        {isFetching && !isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        )}
      </div>

      {/* ─── Desktop Table ─── */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Người dùng</TableHead>
              <TableHead>Nội dung</TableHead>
              <TableHead className="text-right">Số dư cũ</TableHead>
              <TableHead className="text-right">Thay đổi</TableHead>
              <TableHead className="text-right">Số dư mới</TableHead>
              <TableHead>Thời gian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((item: any, i: number) => {
                const change = Number(item.moneyChange) || 0
                const isPositive = change >= 0
                return (
                  <TableRow key={item._id}>
                    <TableCell>
                      <span className="font-mono text-sm font-medium text-muted-foreground">
                        {startRow + i}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">
                          {item.user?.username || "—"}
                        </span>
                        {item.user?.fullname && (
                          <span className="text-xs text-muted-foreground">
                            {item.user.fullname}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <span className="text-sm line-clamp-2">{item.content}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatMoney(item.moneyBefore)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          isPositive ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {formatMoney(change)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(item.moneyAfter)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Chưa có biến động nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Mobile Cards ─── */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : items.length > 0 ? (
          items.map((item: any) => {
            const change = Number(item.moneyChange) || 0
            const isPositive = change >= 0
            return (
              <div key={item._id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{item.user?.username || "—"}</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDateTime(item.createdAt)}
                  </span>
                </div>
                <p className="text-sm">{item.content}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Trước</p>
                    <p className="font-semibold tabular-nums mt-0.5">{formatMoney(item.moneyBefore)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Thay đổi</p>
                    <p className={`font-bold tabular-nums mt-0.5 ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                      {isPositive ? "+" : ""}
                      {formatMoney(change)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sau</p>
                    <p className="font-semibold tabular-nums mt-0.5">{formatMoney(item.moneyAfter)}</p>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            Chưa có biến động nào.
          </div>
        )}
      </div>

      {/* ─── Pagination ─── */}
      {!isLoading && total > 0 && (
        <Pagination
          page={page}
          setPage={setPage}
          limit={limit}
          setLimit={setLimit}
          total={total}
          totalPages={totalPages}
          startRow={startRow}
          endRow={endRow}
        />
      )}
    </div>
  )
}

function Pagination({
  page,
  setPage,
  limit,
  setLimit,
  total,
  totalPages,
  startRow,
  endRow,
}: {
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
        Hiển thị {startRow}-{endRow} / {total} biến động
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Dòng</span>
          <SelectCustom
            value={String(limit)}
            onValueChange={(v) => {
              setLimit(Number(v))
              setPage(1)
            }}
            size="sm"
            className="w-[80px]"
            options={[
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "50", label: "50" },
              { value: "100", label: "100" },
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
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="px-1 text-muted-foreground text-sm">...</span>
                  )}
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
          <span className="sm:hidden text-sm text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
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

function ChevronRight() {
  return (
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
      className="text-muted-foreground/50"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.34-4.34" />
    </svg>
  )
}
