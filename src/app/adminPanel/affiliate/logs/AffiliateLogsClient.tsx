"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SelectCustom } from "@/components/ui/select-custom"
import { IconDollarCircle, IconSearch } from "@/components/icons"

interface AffiliateLogItem {
  _id: string
  moneyBefore: number
  moneyChange: number
  moneyAfter: number
  content: string
  createdAt: string | null
  user: { username: string; fullname: string | null; email: string } | null
}

function formatMoney(value: number | null | undefined): string {
  const n = Number(value)
  return `${new Intl.NumberFormat("vi-VN").format(Number.isFinite(n) ? n : 0)}đ`
}

function formatDateTime(value: string | null): string {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function AffiliateLogsClient() {
  const trpc = useTRPC()
  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])
  const logsQuery = useQuery(
    trpc.adminAffiliate.listLogs.queryOptions({ page, limit, keyword: keyword || undefined })
  )

  const data = logsQuery.data
  const items = (data?.items ?? []) as AffiliateLogItem[]
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">Admin</a>
          <ChevronRight />
          <span>Affiliate</span>
          <ChevronRight />
          <span className="text-foreground">Nhật ký hoa hồng</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600"><IconDollarCircle size={20} /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Nhật ký hoa hồng affiliate</h1><p className="text-sm text-muted-foreground">Theo dõi các khoản hoa hồng phát sinh từ giao dịch giới thiệu.</p></div>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm user, email, nội dung..."
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          {logsQuery.isFetching && !logsQuery.isLoading && <span className="absolute right-3 top-1/2 inline-block h-3 w-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}
        </div>
      </div>

      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Người nhận</TableHead>
              <TableHead>Nội dung</TableHead>
              <TableHead className="text-right">Trước</TableHead>
              <TableHead className="text-right">Hoa hồng</TableHead>
              <TableHead className="text-right">Sau</TableHead>
              <TableHead>Thời gian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, row) => (
                <TableRow key={row}>{Array.from({ length: 7 }).map((__, cell) => <TableCell key={cell}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((item, index) => (
                <TableRow key={item._id}>
                  <TableCell><span className="font-mono text-sm text-muted-foreground">{startRow + index}</span></TableCell>
                  <TableCell><div className="flex flex-col"><span className="font-semibold">{item.user?.username || "--"}</span><span className="text-xs text-muted-foreground">{item.user?.email || item.user?.fullname || "--"}</span></div></TableCell>
                  <TableCell className="max-w-lg"><span className="line-clamp-2 text-sm">{item.content}</span></TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{formatMoney(item.moneyBefore)}</TableCell>
                  <TableCell className="text-right"><Badge className="bg-emerald-500/10 text-emerald-600">+{formatMoney(item.moneyChange)}</Badge></TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">{formatMoney(item.moneyAfter)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(item.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Chưa có nhật ký hoa hồng.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {logsQuery.isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) : items.map((item) => (
          <article key={item._id} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.user?.username || "--"}</p><p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p></div><Badge className="bg-emerald-500/10 text-emerald-600">+{formatMoney(item.moneyChange)}</Badge></div>
            <p className="text-sm">{item.content}</p>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground"><span>Trước: {formatMoney(item.moneyBefore)}</span><span>Sau: {formatMoney(item.moneyAfter)}</span></div>
          </article>
        ))}
        {!logsQuery.isLoading && items.length === 0 && <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Chưa có nhật ký hoa hồng.</div>}
      </div>

      {!logsQuery.isLoading && total > 0 && <Pagination page={page} setPage={setPage} limit={limit} setLimit={setLimit} total={total} totalPages={totalPages} startRow={startRow} endRow={endRow} />}
    </div>
  )
}
function Pagination({ page, setPage, limit, setLimit, total, totalPages, startRow, endRow }: { page: number; setPage: (p: number | ((prev: number) => number)) => void; limit: number; setLimit: (n: number) => void; total: number; totalPages: number; startRow: number; endRow: number }) {
  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <p className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} log</p>
      <div className="flex items-center gap-3">
        <SelectCustom value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1) }} size="sm" className="w-20" options={["10", "20", "50", "100"].map((v) => ({ value: v, label: v }))} />
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 rounded-md border bg-background px-3 text-sm disabled:pointer-events-none disabled:opacity-50">Trước</button>
        <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 rounded-md border bg-background px-3 text-sm disabled:pointer-events-none disabled:opacity-50">Sau</button>
      </div>
    </div>
  )
}

function ChevronRight() {
  return <span className="text-muted-foreground/50">/</span>
}
