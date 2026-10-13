"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { IconCheck, IconSearch, IconWallet } from "@/components/icons"

interface WithdrawItem {
  _id: string
  transId: string
  bank: string
  stk: string
  name: string
  amount: number
  status: number
  reason: string | null
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

function StatusBadge({ status }: { status: number }) {
  if (status === 1) return <Badge className="bg-emerald-500/10 text-emerald-600">Đã duyệt</Badge>
  if (status === 2) return <Badge variant="destructive">Từ chối</Badge>
  return <Badge className="bg-amber-500/10 text-amber-600">Chờ duyệt</Badge>
}
export function AffiliateWithdrawClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const listInput = { page, limit, keyword: keyword || undefined, status: status === "all" ? undefined : Number(status) }
  const withdrawQuery = useQuery(trpc.adminAffiliate.listWithdraws.queryOptions(listInput))
  const statusMutation = useMutation(
    trpc.adminAffiliate.updateWithdrawStatus.mutationOptions({
      onSuccess: async (result) => {
        toast.success(result.message)
        setRejectId(null)
        setReason("")
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.adminAffiliate.listWithdraws.queryKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.adminAffiliate.getStats.queryKey() }),
        ])
      },
      onError: (error) => toast.error(error.message),
    })
  )

  const items = (withdrawQuery.data?.items ?? []) as WithdrawItem[]
  const total = withdrawQuery.data?.total ?? 0
  const totalPages = withdrawQuery.data?.totalPages ?? 1
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  function approve(id: string) {
    if (window.confirm("Duyệt yêu cầu rút hoa hồng này?")) {
      statusMutation.mutate({ id, status: 1 })
    }
  }

  function reject() {
    if (!rejectId) return
    statusMutation.mutate({ id: rejectId, status: 2, reason: reason.trim() || "Admin từ chối" })
  }
  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground"><a href="/adminPanel/dashboard" className="hover:text-foreground">Admin</a><span>/</span><span className="text-foreground">Yêu cầu rút</span></nav>
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600"><IconWallet size={22} /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Yêu cầu rút affiliate</h1><p className="text-sm text-muted-foreground">Duyệt hoặc từ chối các yêu cầu rút hoa hồng về ngân hàng.</p></div>
        </div>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-sm">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm mã, user, ngân hàng..." className="h-9 ps-9" />
        </div>
        <SelectCustom value={status} onValueChange={(value) => { setStatus(value); setPage(1) }} className="w-full md:w-44" options={[{ value: "all", label: "Tất cả" }, { value: "0", label: "Chờ duyệt" }, { value: "1", label: "Đã duyệt" }, { value: "2", label: "Từ chối" }]} />
      </div>

      <div className="hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader><TableRow><TableHead>Mã GD</TableHead><TableHead>User</TableHead><TableHead>Thông tin nhận</TableHead><TableHead className="text-right">Số tiền</TableHead><TableHead>Trạng thái</TableHead><TableHead>Thời gian</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
          <TableBody>
            {withdrawQuery.isLoading ? Array.from({ length: 5 }).map((_, row) => <TableRow key={row}>{Array.from({ length: 7 }).map((__, cell) => <TableCell key={cell}><Skeleton className="h-4 w-24" /></TableCell>)}</TableRow>) : items.length > 0 ? items.map((item) => (
              <TableRow key={item._id}>
                <TableCell className="font-mono text-xs font-semibold">{item.transId}</TableCell>
                <TableCell><div className="flex flex-col"><span className="font-semibold">{item.user?.username || "--"}</span><span className="text-xs text-muted-foreground">{item.user?.email || item.user?.fullname || "--"}</span></div></TableCell>
                <TableCell><div className="text-sm"><p className="font-medium">{item.bank === "BALANCE" ? "Số dư chính" : item.bank}</p><p className="text-xs text-muted-foreground">{item.bank === "BALANCE" ? "Rút tự động" : `${item.stk} - ${item.name}`}</p></div></TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatMoney(item.amount)}</TableCell>
                <TableCell><StatusBadge status={item.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(item.createdAt)}</TableCell>
                <TableCell className="text-right">{item.status === 0 && item.bank !== "BALANCE" ? <div className="flex justify-end gap-2"><Button size="sm" onClick={() => approve(item._id)} disabled={statusMutation.isPending}><IconCheck size={14} /> Duyệt</Button><Button size="sm" variant="destructive" onClick={() => setRejectId(item._id)} disabled={statusMutation.isPending}>Từ chối</Button></div> : <span className="text-xs text-muted-foreground">--</span>}</TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Không có yêu cầu rút.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        {withdrawQuery.isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />) : items.map((item) => (
          <article key={item._id} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold">{item.transId}</p><p className="font-semibold">{item.user?.username || "--"}</p></div><StatusBadge status={item.status} /></div>
            <div className="text-sm"><p>{item.bank === "BALANCE" ? "Số dư chính" : `${item.bank} - ${item.stk}`}</p><p className="text-muted-foreground">{item.name || "Rút tự động"}</p></div>
            <div className="flex items-center justify-between"><span className="font-bold tabular-nums">{formatMoney(item.amount)}</span><span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span></div>
            {item.status === 0 && item.bank !== "BALANCE" && <div className="flex gap-2"><Button size="sm" className="flex-1" onClick={() => approve(item._id)}>Duyệt</Button><Button size="sm" variant="destructive" className="flex-1" onClick={() => setRejectId(item._id)}>Từ chối</Button></div>}
          </article>
        ))}
        {!withdrawQuery.isLoading && items.length === 0 && <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Không có yêu cầu rút.</div>}
      </div>

      {!withdrawQuery.isLoading && total > 0 && <Pagination page={page} setPage={setPage} limit={limit} setLimit={setLimit} total={total} totalPages={totalPages} startRow={startRow} endRow={endRow} />}

      <Dialog open={rejectId !== null} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Từ chối yêu cầu rút</DialogTitle>
            <p className="text-sm text-muted-foreground">Tiền hoa hồng sẽ được hoàn lại cho user.</p>
          </DialogHeader>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do từ chối" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Hủy</Button>
            <Button variant="destructive" onClick={reject} disabled={statusMutation.isPending}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Pagination({ page, setPage, limit, setLimit, total, totalPages, startRow, endRow }: { page: number; setPage: (p: number | ((prev: number) => number)) => void; limit: number; setLimit: (n: number) => void; total: number; totalPages: number; startRow: number; endRow: number }) {
  return <div className="flex flex-col items-center justify-between gap-4 sm:flex-row"><p className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} yêu cầu</p><div className="flex items-center gap-3"><SelectCustom value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1) }} size="sm" className="w-20" options={["10", "20", "50", "100"].map((v) => ({ value: v, label: v }))} /><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Trước</Button><span className="text-sm text-muted-foreground">{page} / {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Sau</Button></div></div>
}
