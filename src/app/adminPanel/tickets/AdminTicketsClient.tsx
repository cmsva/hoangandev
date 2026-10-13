"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { CKEditor } from "@/components/admin/ckeditor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { IconSearch, IconTicket } from "@/components/icons"
import { useTRPC } from "@/trpc/client"
import { useSocket } from "@/components/realtime/SocketProvider"

interface TicketItem { id: string; ticketId: string; username: string; title: string; subject: string; status: string; createdAt: string | null; updatedAt: string | null }
interface TicketMessage { id: string; senderName: string; senderRole: "user" | "admin"; content: string; createdAt: string | null }

const SUBJECT_OPTIONS = [{ value: "all", label: "Tất cả chủ đề" }, { value: "deposit", label: "Nạp tiền" }, { value: "account", label: "Tài khoản" }, { value: "order", label: "Đơn hàng" }, { value: "other", label: "Khác" }]
const STATUS_OPTIONS = [{ value: "all", label: "Tất cả trạng thái" }, { value: "open", label: "Đang mở" }, { value: "pending", label: "Chờ xử lý" }, { value: "replied", label: "Đã trả lời" }, { value: "closed", label: "Đã đóng" }]
const SUBJECT_LABELS: Record<string, string> = { deposit: "Nạp tiền", account: "Tài khoản", order: "Đơn hàng", other: "Khác" }
const STATUS_LABELS: Record<string, string> = { open: "Đang mở", pending: "Chờ xử lý", replied: "Đã trả lời", closed: "Đã đóng" }

function formatDate(value: string | null): string { if (!value) return "--"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "--" : d.toLocaleString("vi-VN") }

export function AdminTicketsClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const socket = useSocket()
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [subject, setSubject] = useState("all")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState("")
  const [configOpen, setConfigOpen] = useState(false)

  useEffect(() => { const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300); return () => clearTimeout(timer) }, [searchInput])

  const listInput = useMemo(() => ({ page, limit: 20, search: search || undefined, subject: subject === "all" ? undefined : subject as "deposit" | "account" | "order" | "other", status: status === "all" ? undefined : status as "open" | "pending" | "replied" | "closed" }), [page, search, subject, status])
  const listQuery = useQuery(trpc.adminTicket.list.queryOptions(listInput, { staleTime: 30_000 }))
  const items = (listQuery.data?.items ?? []) as TicketItem[]
  const selectedTicketId = selectedId ?? items[0]?.id ?? null
  const detailQuery = useQuery({
    ...trpc.adminTicket.getById.queryOptions({ id: selectedTicketId ?? "000000000000000000000000" }),
    enabled: Boolean(selectedTicketId),
    // Real-time qua socket; giữ poll 30s làm fallback nếu socket rớt.
    refetchInterval: (query) => query.state.data?.ticket?.status === "closed" ? false : 30_000,
    refetchIntervalInBackground: false,
    staleTime: 1_000,
  })

  // ─── Real-time: admin nghe ticket mới + reply, join phòng ticket đang xem ───
  useEffect(() => {
    if (!socket) return
    const refreshList = () => { void queryClient.invalidateQueries({ queryKey: trpc.adminTicket.list.queryKey(listInput) }) }
    const refreshDetail = () => { if (selectedTicketId) void queryClient.invalidateQueries({ queryKey: trpc.adminTicket.getById.queryKey({ id: selectedTicketId }) }) }
    const onActivity = () => { refreshList(); refreshDetail() }
    socket.on("admin:newTicket", refreshList)
    socket.on("ticket:reply", onActivity)
    socket.on("ticket:status", onActivity)
    return () => {
      socket.off("admin:newTicket", refreshList)
      socket.off("ticket:reply", onActivity)
      socket.off("ticket:status", onActivity)
    }
  }, [socket, queryClient, trpc, listInput, selectedTicketId])

  // Join phòng ticket đang xem để nhận tin nhắn realtime.
  useEffect(() => {
    if (!socket || !selectedTicketId) return
    const join = () => socket.emit("join_ticket", selectedTicketId)
    join()
    socket.on("connect", join)
    return () => {
      socket.emit("leave_ticket", selectedTicketId)
      socket.off("connect", join)
    }
  }, [socket, selectedTicketId])
  const ticket = detailQuery.data?.ticket as TicketItem | undefined
  const messages = (detailQuery.data?.messages ?? []) as TicketMessage[]

  const replyMutation = useMutation(trpc.adminTicket.reply.mutationOptions({ onSuccess: async () => { setReply(""); await Promise.all([queryClient.invalidateQueries({ queryKey: trpc.adminTicket.list.queryKey(listInput) }), selectedTicketId ? queryClient.invalidateQueries({ queryKey: trpc.adminTicket.getById.queryKey({ id: selectedTicketId }) }) : Promise.resolve()]) }, onError: (error) => toast.error(error.message) }))
  const closeMutation = useMutation(trpc.adminTicket.close.mutationOptions({ onSuccess: async (result) => { toast.success(result.message); await Promise.all([queryClient.invalidateQueries({ queryKey: trpc.adminTicket.list.queryKey(listInput) }), selectedTicketId ? queryClient.invalidateQueries({ queryKey: trpc.adminTicket.getById.queryKey({ id: selectedTicketId }) }) : Promise.resolve()]) }, onError: (error) => toast.error(error.message) }))

  function sendReply() { const content = reply.trim(); if (!content || !selectedTicketId) return; replyMutation.mutate({ ticketId: selectedTicketId, content }) }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1"><p className="text-sm text-muted-foreground">Admin / Hỗ trợ</p><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600"><IconTicket size={22} /></div><div><h1 className="text-2xl font-bold tracking-tight">Quản lý vé hỗ trợ</h1><p className="text-sm text-muted-foreground">Theo dõi, phản hồi và đóng ticket của khách hàng.</p></div></div></div>
        <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={() => setConfigOpen(true)}>Cấu hình</Button><div className="relative"><IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm mã vé, user, tiêu đề..." className="h-9 ps-9 sm:w-72" /></div><SelectCustom value={subject} onValueChange={(v) => { setSubject(v); setPage(1) }} className="sm:w-44" options={SUBJECT_OPTIONS} /><SelectCustom value={status} onValueChange={(v) => { setStatus(v); setPage(1) }} className="sm:w-44" options={STATUS_OPTIONS} /></div>
      </header>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>Ticket</TableHead><TableHead>Khách</TableHead><TableHead>Tiêu đề</TableHead><TableHead>Chủ đề</TableHead><TableHead>Trạng thái</TableHead><TableHead>Cập nhật</TableHead></TableRow></TableHeader><TableBody>{listQuery.isLoading ? Array.from({ length: 6 }).map((_, r) => <TableRow key={r}>{Array.from({ length: 6 }).map((__, c) => <TableCell key={c}><Skeleton className="h-4 w-24" /></TableCell>)}</TableRow>) : items.length > 0 ? items.map((item) => <TableRow key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer ${selectedTicketId === item.id ? "bg-muted/60" : ""}`}><TableCell className="font-mono text-xs font-semibold">#{item.ticketId}</TableCell><TableCell className="font-medium">{item.username}</TableCell><TableCell><span className="line-clamp-1">{item.title}</span></TableCell><TableCell>{SUBJECT_LABELS[item.subject] ?? item.subject}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(item.updatedAt)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Không có ticket phù hợp.</TableCell></TableRow>}</TableBody></Table></div>
        <aside className="flex min-h-[620px] flex-col rounded-xl border bg-card">{!ticket ? <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">Chọn một ticket để phản hồi.</div> : <><div className="border-b p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">#{ticket.ticketId}</p><h2 className="font-semibold">{ticket.title}</h2><p className="text-sm text-muted-foreground">{ticket.username} · {SUBJECT_LABELS[ticket.subject] ?? ticket.subject}</p></div><StatusBadge status={ticket.status} /></div></div><div className="flex-1 space-y-3 overflow-y-auto p-4">{detailQuery.isLoading ? <Skeleton className="h-40 rounded-xl" /> : messages.map((m) => <div key={m.id} className={`flex ${m.senderRole === "admin" ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-2 text-sm ${m.senderRole === "admin" ? "bg-primary text-primary-foreground" : "bg-muted"}`}><p className="mb-1 text-xs opacity-75">{m.senderName} · {formatDate(m.createdAt)}</p><p className="whitespace-pre-wrap">{m.content}</p></div></div>)}</div>{ticket.status !== "closed" ? <form className="space-y-3 border-t p-3" onSubmit={(e) => { e.preventDefault(); sendReply() }}><textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} maxLength={2000} placeholder="Nhập phản hồi cho khách..." className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" /><div className="flex justify-end gap-2"><Button type="button" variant="outline" className="text-rose-600" onClick={() => closeMutation.mutate({ ticketId: ticket.id })} disabled={closeMutation.isPending}>Đóng ticket</Button><Button type="submit" disabled={replyMutation.isPending || !reply.trim()}>{replyMutation.isPending ? "Đang gửi" : "Gửi phản hồi"}</Button></div></form> : <div className="border-t p-4 text-center text-sm text-muted-foreground">Ticket đã đóng.</div>}</>}</aside>
      </section>
      {!listQuery.isLoading && (listQuery.data?.total ?? 0) > 0 && <Pagination page={page} setPage={setPage} totalPages={listQuery.data?.totalPages ?? 1} total={listQuery.data?.total ?? 0} />}
      <TicketGuideConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "closed" ? "bg-rose-500/10 text-rose-600" : status === "replied" ? "bg-blue-500/10 text-blue-600" : status === "pending" ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{STATUS_LABELS[status] ?? status}</span>
}

function Pagination({ page, setPage, totalPages, total }: { page: number; setPage: (p: number | ((prev: number) => number)) => void; totalPages: number; total: number }) {
  return <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Tổng {total} ticket</p><div className="flex items-center gap-3"><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Trước</Button><span className="text-sm text-muted-foreground">{page} / {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Sau</Button></div></div>
}

function TicketGuideConfigDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [noteHtml, setNoteHtml] = useState("")
  const [processHtml, setProcessHtml] = useState("")
  const configQuery = useQuery({ ...trpc.adminTicket.getCreateGuideConfig.queryOptions(), enabled: open })

  useEffect(() => {
    if (!configQuery.data) return
    setNoteHtml(configQuery.data.noteHtml)
    setProcessHtml(configQuery.data.processHtml)
  }, [configQuery.data])

  const saveMutation = useMutation(trpc.adminTicket.updateCreateGuideConfig.mutationOptions({
    onSuccess: async (data) => {
      toast.success("Đã lưu cấu hình")
      setNoteHtml(data.noteHtml)
      setProcessHtml(data.processHtml)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.adminTicket.getCreateGuideConfig.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ticket.createGuideConfig.queryKey() }),
      ])
      onOpenChange(false)
    },
    onError: (error) => toast.error(error.message),
  }))

  return (
    <Dialog open={open} onOpenChange={(next) => !saveMutation.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>Cấu hình nội dung tạo ticket</DialogTitle></DialogHeader>
        {configQuery.isLoading ? <Skeleton className="h-96 w-full rounded-xl" /> : <div className="space-y-5">
          <div className="space-y-2"><p className="text-sm font-medium">Lưu ý</p><CKEditor value={noteHtml} onChange={setNoteHtml} height={260} /></div>
          <div className="space-y-2"><p className="text-sm font-medium">Quy trình xử lý</p><CKEditor value={processHtml} onChange={setProcessHtml} height={260} /></div>
        </div>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>Hủy</Button><Button type="button" onClick={() => saveMutation.mutate({ noteHtml, processHtml })} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Đang lưu" : "Lưu cấu hình"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
