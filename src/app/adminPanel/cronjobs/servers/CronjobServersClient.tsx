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

function formatMoney(n: number | null | undefined) {
  const num = Number(n)
  return new Intl.NumberFormat("vi-VN").format(Number.isFinite(num) ? num : 0) + "đ"
}

function toDateInputValue(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function AdminCronjobServersClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [editing, setEditing] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<any | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminCronjob.listServers.queryOptions({
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

  const deleteMut = useMutation({
    ...trpc.adminCronjob.deleteServer.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa máy chủ")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminCronjob.listServers.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminCronjob.bulkDeleteServers.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} server`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminCronjob.listServers.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a>
            <ChevronRight />
            <span>Cron Jobs</span>
            <ChevronRight />
            <span className="text-foreground">Máy chủ</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
              <IconClock size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Máy chủ Cronjob</h1>
              <p className="text-sm text-muted-foreground">
                Quản lý các gói máy chủ cho khách thuê chạy job tự động.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
        >
          <PlusIcon /> Thêm máy chủ
        </button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon />
        <input
          type="text"
          placeholder="Tìm theo tên máy chủ..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        {isFetching && !isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        )}
      </div>

      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <BulkSelectHead checked={bulk.isAllSelected} onChange={bulk.toggleAll} />
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Tên máy chủ</TableHead>
              <TableHead className="text-right">Giá / tháng</TableHead>
              <TableHead className="text-center">Vòng lặp</TableHead>
              <TableHead className="text-center">Slot dùng / tổng</TableHead>
              <TableHead className="text-center">% giảm</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((s: any, i: number) => {
                const utilization = s.usageLimit > 0 ? Math.round((s.currentUsage / s.usageLimit) * 100) : 0
                return (
                  <TableRow key={s.id}><BulkSelectCell checked={bulk.isSelected(s.id)} onChange={() => bulk.toggle(s.id)} />
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">{startRow + i}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-bold text-emerald-600 tabular-nums">{formatMoney(s.price)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-mono">{s.timeloop}s</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-sm font-semibold tabular-nums">{s.currentUsage}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-sm tabular-nums">{s.usageLimit}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${utilization >= 90 ? "bg-rose-500/15 text-rose-600" : utilization >= 60 ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"}`}>
                          {utilization}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {s.discountPercent > 0 ? (
                        <span className="rounded-full bg-rose-500/15 text-rose-600 px-2 py-0.5 text-[11px] font-bold">
                          -{s.discountPercent}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Hoạt động</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">Tắt</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditing(s)}
                          className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 px-2.5 h-8 text-xs font-medium hover:bg-primary/20 transition-all"
                        >
                          <EditIcon /> Sửa
                        </button>
                        <button
                          onClick={() => setDeleting(s)}
                          className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 px-2.5 h-8 text-xs font-medium hover:bg-rose-500/20 transition-all"
                        >
                          <TrashIcon /> Xóa
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Chưa có máy chủ nào.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {items.map((s: any) => (
          <div key={s.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{s.name}</span>
              {s.isActive ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Hoạt động</span>
              ) : (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">Tắt</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Giá</p>
                <p className="font-bold text-emerald-600 mt-0.5 tabular-nums">{formatMoney(s.price)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vòng lặp</p>
                <p className="font-mono mt-0.5">{s.timeloop}s</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Slot</p>
                <p className="font-semibold mt-0.5 tabular-nums">{s.currentUsage} / {s.usageLimit}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(s)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary h-8 text-xs font-medium">
                <EditIcon /> Sửa
              </button>
              <button onClick={() => setDeleting(s)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-rose-500/10 text-rose-600 h-8 text-xs font-medium">
                <TrashIcon /> Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} máy chủ</div>
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

      {(creating || editing) && (
        <ServerFormDialog
          editing={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => qc.invalidateQueries({ queryKey: trpc.adminCronjob.listServers.queryKey() })}
        />
      )}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClearAll={bulk.clearAll}
        onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })}
        isPending={bulkDeleteMut.isPending}
        entityLabel="server"
      />


      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa máy chủ cronjob"
        description={`Xóa "${deleting?.name}"? Sẽ chặn nếu còn cronjob đang active.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}

function ServerFormDialog({ editing, onClose, onSaved }: { editing: any | null; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const isEdit = !!editing

  const [name, setName] = useState(editing?.name ?? "")
  const [price, setPrice] = useState<number>(editing?.price ?? 0)
  const [usageLimit, setUsageLimit] = useState<number>(editing?.usageLimit ?? 100)
  const [timeloop, setTimeloop] = useState<number>(editing?.timeloop ?? 30)
  const [discountPercent, setDiscountPercent] = useState<number>(editing?.discountPercent ?? 0)
  const [discountValidUntil, setDiscountValidUntil] = useState<string>(toDateInputValue(editing?.discountValidUntil ?? null))
  const [isActive, setIsActive] = useState<boolean>(editing?.isActive ?? true)

  const createMut = useMutation({
    ...trpc.adminCronjob.createServer.mutationOptions(),
    onSuccess: () => { toast.success("Tạo máy chủ thành công"); onSaved(); onClose() },
    onError: (err: any) => toast.error(err.message || "Tạo thất bại"),
  })
  const updateMut = useMutation({
    ...trpc.adminCronjob.updateServer.mutationOptions(),
    onSuccess: () => { toast.success("Cập nhật thành công"); onSaved(); onClose() },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })
  const isPending = createMut.isPending || updateMut.isPending

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên máy chủ")
      return
    }
    const data = {
      name: name.trim(),
      price: Number(price) || 0,
      usageLimit: Number(usageLimit) || 0,
      timeloop: Math.max(1, Number(timeloop) || 1),
      discountPercent: Number(discountPercent) || 0,
      discountValidUntil: discountValidUntil
        ? new Date(discountValidUntil).toISOString()
        : null,
      isActive,
    }
    if (isEdit) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex flex-col gap-1 min-w-0">
            <span className="text-base font-semibold">{isEdit ? "Cập nhật máy chủ" : "Thêm máy chủ mới"}</span>
            {isEdit && editing.name && (
              <span className="text-[13px] font-normal text-muted-foreground line-clamp-2 break-words" title={editing.name}>
                {editing.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Tên máy chủ" required>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Server VIP - Cronjob Premium" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá / tháng (đ)" required>
              <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
            </Field>
            <Field label="Vòng lặp tối thiểu (giây)" required>
              <input type="number" min={1} value={timeloop} onChange={(e) => setTimeloop(Number(e.target.value) || 1)} className={`${inputCls} tabular-nums`} />
            </Field>
            <Field label="Slot tổng" required hint="Số job tối đa server có thể chạy">
              <input type="number" min={0} value={usageLimit} onChange={(e) => setUsageLimit(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
            </Field>
            <Field label="% giảm giá" hint="0-100">
              <input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
            </Field>
          </div>
          <Field label="Hết hạn KM" hint="Để trống nếu không có">
            <input type="date" value={discountValidUntil} onChange={(e) => setDiscountValidUntil(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Trạng thái">
            <SelectCustom
              value={isActive ? "1" : "0"}
              onValueChange={(v) => setIsActive(v === "1")}
              options={[
                { value: "1", label: "Hoạt động" },
                { value: "0", label: "Tắt" },
              ]}
            />
          </Field>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <button onClick={onClose} disabled={isPending} className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">Hủy</button>
          <button onClick={handleSubmit} disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {isPending ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo mới"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const inputCls = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ChevronRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg> }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg> }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg> }
function EditIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg> }
function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
