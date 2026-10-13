"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { TicketShell } from "@/components/ticket-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { IconPlus, IconSearch, IconTicket } from "@/components/icons"
import { useTRPC } from "@/trpc/client"

interface TicketItem { id: string; ticketId: string; title: string; subject: string; status: string; createdAt: string | null; updatedAt: string | null }

const SUBJECT_OPTIONS = [{ value: "all", label: "Tất cả chủ đề" }, { value: "deposit", label: "Nạp tiền" }, { value: "account", label: "Tài khoản" }, { value: "order", label: "Đơn hàng" }, { value: "other", label: "Khác" }]
const STATUS_OPTIONS = [{ value: "all", label: "Tất cả trạng thái" }, { value: "open", label: "Đang mở" }, { value: "pending", label: "Chờ xử lý" }, { value: "replied", label: "Đã trả lời" }, { value: "closed", label: "Đã đóng" }]
const SUBJECT_LABELS: Record<string, string> = { deposit: "Nạp tiền", account: "Tài khoản", order: "Đơn hàng", other: "Khác" }
const STATUS_LABELS: Record<string, string> = { open: "Đang mở", pending: "Chờ xử lý", replied: "Đã trả lời", closed: "Đã đóng" }

function formatDate(value: string | null) { if (!value) return "--"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "--" : d.toLocaleString("vi-VN") }

export function TicketHistoryClient() {
  const trpc = useTRPC()
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [subject, setSubject] = useState("all")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 350); return () => clearTimeout(t) }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(trpc.ticket.list.queryOptions({ page, limit, search: search || undefined, subject: subject === "all" ? undefined : subject as any, status: status === "all" ? undefined : status as any }))
  const items = (data?.items ?? []) as TicketItem[]
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  return (
    <TicketShell>
      <div className="space-y-6">
        <header className="space-y-1"><nav className="flex items-center gap-1.5 text-sm text-muted-foreground"><a href="/dashboard" className="hover:text-foreground">Trang chủ</a><span>/</span><span className="text-foreground">Lịch sử vé</span></nav><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600"><IconTicket size={20} /></div><div><h1 className="text-2xl font-bold tracking-tight">Lịch sử vé hỗ trợ</h1><p className="text-sm text-muted-foreground">Theo dõi các yêu cầu và mở khung chat 1-1 với admin.</p></div></div><Button asChild><a href="/ticket/create"><IconPlus size={16} /> Tạo vé</a></Button></div></header>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center"><div className="relative max-w-sm flex-1"><IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm ticket..." className="h-9 ps-9" />{isFetching && !isLoading && <span className="absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}</div><SelectCustom value={subject} onValueChange={(v) => { setSubject(v); setPage(1) }} className="w-full lg:w-48" options={SUBJECT_OPTIONS} /><SelectCustom value={status} onValueChange={(v) => { setStatus(v); setPage(1) }} className="w-full lg:w-48" options={STATUS_OPTIONS} /></div>
        <div className="hidden rounded-md border md:block"><Table><TableHeader><TableRow><TableHead>Ticket</TableHead><TableHead>Tiêu đề</TableHead><TableHead>Chủ đề</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ngày tạo</TableHead><TableHead className="text-end">Thao tác</TableHead></TableRow></TableHeader><TableBody>{isLoading ? Array.from({ length: 5 }).map((_, r) => <TableRow key={r}>{Array.from({ length: 6 }).map((__, c) => <TableCell key={c}><Skeleton className="h-4 w-24" /></TableCell>)}</TableRow>) : items.length > 0 ? items.map((item) => <TableRow key={item.id}><TableCell className="font-mono text-xs font-semibold">#{item.ticketId}</TableCell><TableCell><span className="line-clamp-1 font-medium">{item.title}</span></TableCell><TableCell>{SUBJECT_LABELS[item.subject] ?? item.subject}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</TableCell><TableCell className="text-end"><Button size="sm" variant="outline" asChild><a href={`/ticket/${item.id}`}>Chi tiết</a></Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Chưa có vé hỗ trợ.</TableCell></TableRow>}</TableBody></Table></div>

        <div className="space-y-3 md:hidden">{isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) : items.map((item) => <article key={item.id} className="space-y-3 rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold">#{item.ticketId}</p><p className="font-semibold">{item.title}</p></div><StatusBadge status={item.status} /></div><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{SUBJECT_LABELS[item.subject] ?? item.subject}</span><span>{formatDate(item.createdAt)}</span></div><Button size="sm" variant="outline" className="w-full" asChild><a href={`/ticket/${item.id}`}>Mở chat</a></Button></article>)}{!isLoading && items.length === 0 && <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Chưa có vé hỗ trợ.</div>}</div>

        {!isLoading && total > 0 && <Pagination page={page} setPage={setPage} limit={limit} setLimit={setLimit} total={total} totalPages={totalPages} startRow={startRow} endRow={endRow} />}
      </div>
    </TicketShell>
  )
}
function StatusBadge({ status }: { status: string }) {
  const color = status === "closed" ? "bg-rose-500/10 text-rose-600" : status === "replied" ? "bg-blue-500/10 text-blue-600" : status === "pending" ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{STATUS_LABELS[status] ?? status}</span>
}

function Pagination({ page, setPage, limit, setLimit, total, totalPages, startRow, endRow }: { page: number; setPage: (p: number | ((prev: number) => number)) => void; limit: number; setLimit: (n: number) => void; total: number; totalPages: number; startRow: number; endRow: number }) {
  return <div className="flex flex-col items-center justify-between gap-4 sm:flex-row"><p className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} vé</p><div className="flex items-center gap-3"><SelectCustom value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1) }} size="sm" className="w-20" options={["10", "20", "50"].map((v) => ({ value: v, label: v }))} /><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Trước</Button><span className="text-sm text-muted-foreground">{page} / {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Sau</Button></div></div>
}
