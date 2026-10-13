"use client"

import { useBulkSelect } from "@/hooks/use-bulk-select"
import { BulkActionBar, BulkSelectHead, BulkSelectCell } from "@/components/admin/bulk-action-bar"

import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { IconClock } from "@/components/icons"

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Đang chạy", color: "bg-emerald-500/15 text-emerald-600" },
  paused: { label: "Tạm dừng", color: "bg-amber-500/15 text-amber-600" },
  expired: { label: "Hết hạn", color: "bg-rose-500/15 text-rose-600" },
}
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([v, { label }]) => ({ value: v, label }))

function formatMoney(n: number | null | undefined) {
  const num = Number(n)
  return new Intl.NumberFormat("vi-VN").format(Number.isFinite(num) ? num : 0) + "đ"
}

function formatDateTime(input: any) {
  if (!input) return "—"
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDateTimeInputValue(iso: string | Date | null) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AdminCronjobOrdersClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<any | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminCronjob.listOrders.queryOptions({
      page,
      limit,
      keyword: keyword || undefined,
      status: (statusFilter || undefined) as any,
    })
  ) as { data: any; isLoading: boolean; isFetching: boolean }

  const items: any[] = data?.items ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  const deleteMut = useMutation({
    ...trpc.adminCronjob.deleteOrder.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa cronjob")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminCronjob.listOrders.queryKey() })
      qc.invalidateQueries({ queryKey: trpc.adminCronjob.listServers.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminCronjob.bulkDeleteOrders.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} đơn cronjob`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminCronjob.listOrders.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a>
          <ChevronRight />
          <span>Cron Jobs</span>
          <ChevronRight />
          <span className="text-foreground">Đơn hàng</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
            <IconClock size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Đơn Cronjob</h1>
            <p className="text-sm text-muted-foreground">
              Quản lý các cronjob khách đã thuê. Cho phép chỉnh sửa và xóa toàn bộ.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <SearchIcon />
          <input
            type="text"
            placeholder="Tìm theo URL, máy chủ, username..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          {isFetching && !isLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          )}
        </div>
        <SelectCustom
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v); setPage(1) }}
          className="w-full sm:w-[180px]"
          options={[{ value: "", label: "Tất cả trạng thái" }, ...STATUS_OPTIONS]}
        />
      </div>

      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <BulkSelectHead checked={bulk.isAllSelected} onChange={bulk.toggleAll} />
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Khách</TableHead>
              <TableHead>URL / Method</TableHead>
              <TableHead>Máy chủ</TableHead>
              <TableHead className="text-center">Interval</TableHead>
              <TableHead className="text-right">Trả</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Lần chạy</TableHead>
              <TableHead>Hết hạn</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((c: any, i: number) => {
                const st = STATUS_LABELS[c.status] ?? { label: c.status, color: "bg-gray-500/10 text-gray-500" }
                return (
                  <TableRow key={c.id}><BulkSelectCell checked={bulk.isSelected(c.id)} onChange={() => bulk.toggle(c.id)} />
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">{startRow + i}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{c.user?.username ?? "—"}</span>
                        {c.user?.fullname && <span className="text-xs text-muted-foreground">{c.user.fullname}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[260px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${c.method === "GET" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                            {c.method}
                          </span>
                          {c.statusCode != null && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${c.statusCode >= 200 && c.statusCode < 400 ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"}`}>
                              {c.statusCode}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs truncate mt-0.5" title={c.url}>{c.url}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{c.serverName}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-mono tabular-nums">{c.intervalSeconds}s</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-bold tabular-nums">{formatMoney(c.payment)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{st.label}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(c.lastRun)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(c.expiresAt)}</span>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setEditing(c)} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 px-2.5 h-8 text-xs font-medium hover:bg-primary/20 transition-all">
                          <EditIcon /> Sửa
                        </button>
                        <button onClick={() => setDeleting(c)} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 px-2.5 h-8 text-xs font-medium hover:bg-rose-500/20 transition-all">
                          <TrashIcon /> Xóa
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">Chưa có cronjob nào.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {items.map((c: any) => {
          const st = STATUS_LABELS[c.status] ?? { label: c.status, color: "bg-gray-500/10 text-gray-500" }
          return (
            <div key={c.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{c.user?.username ?? "—"}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{st.label}</span>
              </div>
              <p className="font-mono text-xs truncate" title={c.url}>{c.method} · {c.url}</p>
              <div className="text-xs text-muted-foreground">
                {c.serverName} · {c.intervalSeconds}s · {formatMoney(c.payment)}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(c)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary h-8 text-xs font-medium">
                  <EditIcon /> Sửa
                </button>
                <button onClick={() => setDeleting(c)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-rose-500/10 text-rose-600 h-8 text-xs font-medium">
                  <TrashIcon /> Xóa
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} cronjob</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Dòng</span>
              <SelectCustom
                value={String(limit)}
                onValueChange={(v) => { setLimit(Number(v)); setPage(1) }}
                size="sm"
                className="w-[80px]"
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                ]}
              />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium hover:bg-accent disabled:opacity-50">Trước</button>
              <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium hover:bg-accent disabled:opacity-50">Sau</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <CronjobEditDialog
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: trpc.adminCronjob.listOrders.queryKey() })}
        />
      )}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClearAll={bulk.clearAll}
        onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })}
        isPending={bulkDeleteMut.isPending}
        entityLabel="đơn cronjob"
      />


      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa cronjob"
        description={`Xóa cronjob ${deleting?.url ?? ""}? Hành động không thể hoàn tác.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}

function CronjobEditDialog({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const [status, setStatus] = useState(order.status)
  const [url, setUrl] = useState(order.url ?? "")
  const [method, setMethod] = useState(order.method ?? "GET")
  const [intervalSeconds, setIntervalSeconds] = useState<number>(order.intervalSeconds ?? 60)
  const [headers, setHeaders] = useState(order.headers ?? "")
  const [body, setBody] = useState(order.body ?? "")
  const [payment, setPayment] = useState<number>(order.payment ?? 0)
  const [expiresAt, setExpiresAt] = useState<string>(toDateTimeInputValue(order.expiresAt))

  const updateMut = useMutation({
    ...trpc.adminCronjob.updateOrder.mutationOptions(),
    onSuccess: () => {
      toast.success("Cập nhật thành công")
      onSaved()
      onClose()
    },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })

  function handleSubmit() {
    updateMut.mutate({
      id: order.id,
      data: {
        status,
        url: url.trim(),
        method,
        intervalSeconds: Math.max(1, Number(intervalSeconds) || 1),
        headers: headers.trim() || null,
        body: body.trim() || null,
        payment: Number(payment) || 0,
        expiresAt: expiresAt || undefined,
      },
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !updateMut.isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-xl">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex flex-col gap-1 min-w-0">
            <span className="text-base font-semibold">Sửa cronjob</span>
            <span className="text-[13px] font-mono text-muted-foreground truncate" title={order.url}>
              {order.url}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted/40 border p-3 space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Khách</span>
              <span className="font-semibold truncate text-right">{order.user?.username ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Máy chủ</span>
              <span className="font-medium truncate text-right">{order.serverName}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Trạng thái" required>
              <SelectCustom value={status} onValueChange={(v: string) => setStatus(v)} options={STATUS_OPTIONS} />
            </Field>
            <Field label="Method">
              <SelectCustom
                value={method}
                onValueChange={(v: string) => setMethod(v as "GET" | "POST")}
                options={[
                  { value: "GET", label: "GET" },
                  { value: "POST", label: "POST" },
                ]}
              />
            </Field>
            <Field label="Interval (giây)" required>
              <input type="number" min={1} value={intervalSeconds} onChange={(e) => setIntervalSeconds(Number(e.target.value) || 1)} className={`${inputCls} tabular-nums`} />
            </Field>
          </div>

          <Field label="URL" required>
            <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={`${inputCls} font-mono text-xs`} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tổng tiền (đ)">
              <input type="number" min={0} value={payment} onChange={(e) => setPayment(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
            </Field>
            <Field label="Hết hạn">
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Headers (JSON, optional)">
            <textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              rows={2}
              maxLength={8192}
              placeholder='{"Authorization": "Bearer xxx"}'
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </Field>

          {method === "POST" && (
            <Field label="Body (raw, optional)">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                maxLength={16384}
                placeholder='{"key": "value"}'
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </Field>
          )}
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <button onClick={onClose} disabled={updateMut.isPending} className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">Hủy</button>
          <button onClick={handleSubmit} disabled={updateMut.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {updateMut.isPending ? "Đang lưu..." : "Cập nhật"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const inputCls = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

function ChevronRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg> }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg> }
function EditIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg> }
function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
