"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { TicketShell } from "@/components/ticket-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { IconTicket } from "@/components/icons"
import { useTRPC } from "@/trpc/client"
import { useSocket } from "@/components/realtime/SocketProvider"

function formatTime(value: string | null) { if (!value) return ""; const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) }

export function TicketDetailClient({ id }: { id: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const socket = useSocket()
  const [message, setMessage] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const detailQuery = useQuery({
    ...trpc.ticket.getById.queryOptions({ id }),
    // Real-time qua socket; giữ poll 30s làm fallback nếu socket rớt.
    refetchInterval: (query) => query.state.data?.ticket?.status === "closed" ? false : 30_000,
    refetchIntervalInBackground: false,
    staleTime: 1_000,
  })

  // ─── Real-time: join phòng ticket + nghe tin nhắn/đổi trạng thái ───
  useEffect(() => {
    if (!socket) return
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: trpc.ticket.getById.queryKey({ id }) })
    }
    const join = () => socket.emit("join_ticket", id)
    join()
    socket.on("connect", join)
    socket.on("ticket:reply", refresh)
    socket.on("ticket:status", refresh)
    return () => {
      socket.emit("leave_ticket", id)
      socket.off("connect", join)
      socket.off("ticket:reply", refresh)
      socket.off("ticket:status", refresh)
    }
  }, [socket, id, queryClient, trpc])
  const sendMutation = useMutation(trpc.ticket.sendMessage.mutationOptions({ onSuccess: async () => { setMessage(""); await queryClient.invalidateQueries({ queryKey: trpc.ticket.getById.queryKey({ id }) }) }, onError: (e) => toast.error(e.message) }))
  const closeMutation = useMutation(trpc.ticket.close.mutationOptions({ onSuccess: async (r) => { toast.success(r.message); await queryClient.invalidateQueries({ queryKey: trpc.ticket.getById.queryKey({ id }) }) }, onError: (e) => toast.error(e.message) }))

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [detailQuery.data?.messages?.length])

  const ticket = detailQuery.data?.ticket
  const messages = detailQuery.data?.messages ?? []

  function send() {
    const content = message.trim()
    if (!content) return
    sendMutation.mutate({ ticketId: id, content })
  }
  return (
    <TicketShell>
      {detailQuery.isLoading ? <Skeleton className="h-[640px] rounded-xl" /> : !ticket ? <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Không tìm thấy ticket.</div> : (
        <div className="grid h-[calc(100vh-7rem)] gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600"><IconTicket size={20} /></div><div><p className="font-mono text-xs text-muted-foreground">#{ticket.ticketId}</p><h1 className="font-semibold">{ticket.title}</h1></div></div>
            <div className="mt-5 space-y-3 text-sm"><Info label="Người gửi" value={ticket.username} /><Info label="Trạng thái" value={ticket.status} /><Info label="Ngày tạo" value={ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("vi-VN") : "--"} /><Info label="Tin nhắn" value={String(messages.length)} /></div>
            {ticket.status !== "closed" && <Button variant="outline" className="mt-5 w-full text-rose-600" onClick={() => closeMutation.mutate({ ticketId: id })} disabled={closeMutation.isPending}>Đóng ticket</Button>}
            <Button variant="ghost" className="mt-2 w-full" asChild><a href="/customer/history/ticket">Quay lại lịch sử</a></Button>
          </aside>
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
            <div className="border-b p-4"><h2 className="font-semibold">Chat với hỗ trợ</h2><p className="text-sm text-muted-foreground">Tin nhắn được tự động làm mới định kỳ.</p></div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((m: any) => { const isUser = m.senderRole === "user"; return <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}><p className="mb-1 text-xs opacity-75">{m.senderName} • {formatTime(m.createdAt)}</p><p className="whitespace-pre-wrap">{m.content}</p></div></div> })}<div ref={endRef} /></div>
            {ticket.status !== "closed" ? <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send() }}><Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Nhập tin nhắn..." /><Button type="submit" disabled={sendMutation.isPending || !message.trim()}>{sendMutation.isPending ? "Đang gửi" : "Gửi"}</Button></form> : <div className="border-t p-4 text-center text-sm text-muted-foreground">Ticket đã đóng.</div>}
          </section>
        </div>
      )}
    </TicketShell>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 border-b pb-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-medium text-right">{value}</span></div>
}
