"use client"

import { useBulkSelect } from "@/hooks/use-bulk-select"
import { BulkActionBar, BulkSelectHead, BulkSelectCell } from "@/components/admin/bulk-action-bar"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { IconCreditCard, IconPlus, IconSearch, IconTrash } from "@/components/icons"

type CouponScope = "all" | "source-code" | "website" | "domain" | "logo" | "cronjob"

interface CouponItem {
  id: string
  code: string
  amount: number
  used: number
  discount: number
  min: number
  max: number
  scope: CouponScope
  createdAt: string | null
}

interface CouponFormState {
  code: string
  amount: string
  discount: string
  min: string
  max: string
  scope: CouponScope
}

const SCOPE_OPTIONS: { value: CouponScope; label: string }[] = [
  { value: "all", label: "Toàn bộ dịch vụ" },
  { value: "source-code", label: "Mã nguồn" },
  { value: "website", label: "Website" },
  { value: "domain", label: "Tên miền" },
  { value: "logo", label: "Logo" },
  { value: "cronjob", label: "Cron Jobs" },
]

const emptyForm: CouponFormState = { code: "", amount: "100", discount: "10", min: "0", max: "0", scope: "all" }
function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`
}

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = "SALE"
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function getScopeLabel(scope: CouponScope): string {
  return SCOPE_OPTIONS.find((item) => item.value === scope)?.label ?? scope
}

function toPayload(form: CouponFormState) {
  return {
    code: form.code.trim().toUpperCase(),
    amount: Number(form.amount),
    discount: Number(form.discount),
    min: Number(form.min),
    max: Number(form.max),
    scope: form.scope,
  }
}

export function CouponClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [scope, setScope] = useState<CouponScope | "all-filter">("all-filter")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [editing, setEditing] = useState<CouponItem | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleting, setDeleting] = useState<CouponItem | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])
  const queryInput = { page, limit, keyword: keyword || undefined, scope: scope === "all-filter" ? undefined : scope }
  const { data, isLoading, isFetching } = useQuery(trpc.adminCoupon.list.queryOptions(queryInput))
  const items = (data?.items ?? []) as CouponItem[]
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: trpc.adminCoupon.list.queryKey() })

  const createMutation = useMutation(trpc.adminCoupon.create.mutationOptions({
    onSuccess: (result) => { toast.success(result.message); setIsCreating(false); invalidateList() },
    onError: (error) => toast.error(error.message),
  }))
  const updateMutation = useMutation(trpc.adminCoupon.update.mutationOptions({
    onSuccess: (result) => { toast.success(result.message); setEditing(null); invalidateList() },
    onError: (error) => toast.error(error.message),
  }))
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation(trpc.adminCoupon.bulkDelete.mutationOptions({
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} mã`); bulk.clearAll(); invalidateList() },
    onError: (error) => toast.error(error.message),
  }))

  const deleteMutation = useMutation(trpc.adminCoupon.delete.mutationOptions({
    onSuccess: (result) => { toast.success(result.message); setDeleting(null); invalidateList() },
    onError: (error) => toast.error(error.message),
  }))

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">Admin</a>
          <ChevronRight />
          <span className="text-foreground">Mã giảm giá</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600"><IconCreditCard size={20} /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Mã giảm giá</h1><p className="text-sm text-muted-foreground">Quản lý mã giảm giá theo dịch vụ, hạn mức đơn hàng và số lượt sử dụng.</p></div>
        </div>
      </header>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm mã giảm giá..." className="h-9 ps-9" />
          {isFetching && !isLoading && <span className="absolute right-3 top-1/2 inline-block h-3 w-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}
        </div>
        <SelectCustom value={scope} onValueChange={(value) => { setScope(value as CouponScope | "all-filter"); setPage(1) }} className="w-full sm:w-[200px]" options={[{ value: "all-filter", label: "Tất cả phạm vi" }, ...SCOPE_OPTIONS]} />
        <Button onClick={() => setIsCreating(true)}><IconPlus size={16} /> Thêm mã</Button>
      </div>

      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader><TableRow><BulkSelectHead checked={bulk.isAllSelected} onChange={bulk.toggleAll} /><TableHead>#</TableHead><TableHead>Mã</TableHead><TableHead>Phạm vi</TableHead><TableHead className="text-right">Giảm</TableHead><TableHead className="text-right">Hạn mức đơn</TableHead><TableHead className="text-center">Đã dùng</TableHead><TableHead className="text-end">Thao tác</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, row) => <TableRow key={row}>{Array.from({ length: 8 }).map((__, cell) => <TableCell key={cell}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : items.length > 0 ? items.map((item, index) => (
              <TableRow key={item.id}>
                <BulkSelectCell checked={bulk.isSelected(item.id)} onChange={() => bulk.toggle(item.id)} />
                <TableCell><span className="font-mono text-sm text-muted-foreground">{startRow + index}</span></TableCell>
                <TableCell><span className="font-mono text-sm font-bold">{item.code}</span></TableCell>
                <TableCell><span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{getScopeLabel(item.scope)}</span></TableCell>
                <TableCell className="text-right font-semibold text-emerald-600">{item.discount}%</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{item.min > 0 ? formatMoney(item.min) : "0"} - {item.max > 0 ? formatMoney(item.max) : "Không giới hạn"}</TableCell>
                <TableCell className="text-center text-sm">{item.used}/{item.amount}</TableCell>
                <TableCell className="text-end"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(item)}>Sửa</Button><Button size="sm" variant="destructive" onClick={() => setDeleting(item)}><IconTrash size={14} /></Button></div></TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Chưa có mã giảm giá.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) : items.map((item) => (
          <article key={item.id} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono font-bold">{item.code}</p><p className="text-xs text-muted-foreground">{getScopeLabel(item.scope)}</p></div><span className="font-bold text-emerald-600">-{item.discount}%</span></div>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground"><span>Đơn min: {item.min > 0 ? formatMoney(item.min) : "0"}</span><span>Đơn max: {item.max > 0 ? formatMoney(item.max) : "Không giới hạn"}</span><span>Đã dùng: {item.used}/{item.amount}</span></div>
            <div className="flex gap-2"><Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(item)}>Sửa</Button><Button size="sm" variant="destructive" className="flex-1" onClick={() => setDeleting(item)}>Xóa</Button></div>
          </article>
        ))}
        {!isLoading && items.length === 0 && <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Chưa có mã giảm giá.</div>}
      </div>

      {!isLoading && total > 0 && <Pagination page={page} setPage={setPage} limit={limit} setLimit={setLimit} total={total} totalPages={totalPages} startRow={startRow} endRow={endRow} />}

      {(isCreating || editing) && <CouponFormDialog coupon={editing} onClose={() => { setIsCreating(false); setEditing(null) }} onSubmit={(form) => editing ? updateMutation.mutate({ id: editing.id, ...toPayload(form) }) : createMutation.mutate(toPayload(form))} isPending={createMutation.isPending || updateMutation.isPending} />}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClearAll={bulk.clearAll}
        onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })}
        isPending={bulkDeleteMut.isPending}
        entityLabel="mã giảm giá"
      />

      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Xóa mã giảm giá?" description={deleting ? `Mã ${deleting.code} sẽ bị xóa nếu chưa có lịch sử sử dụng.` : undefined} variant="destructive" confirmText="Xóa" onConfirm={() => deleting && deleteMutation.mutate({ id: deleting.id })} isPending={deleteMutation.isPending} />
    </div>
  )
}
function CouponFormDialog({ coupon, onClose, onSubmit, isPending }: { coupon: CouponItem | null; onClose: () => void; onSubmit: (form: CouponFormState) => void; isPending: boolean }) {
  const [form, setForm] = useState<CouponFormState>(() => coupon ? { code: coupon.code, amount: String(coupon.amount), discount: String(coupon.discount), min: String(coupon.min), max: String(coupon.max), scope: coupon.scope } : emptyForm)

  function setField<K extends keyof CouponFormState>(key: K, value: CouponFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit() {
    if (!form.code.trim()) return toast.error("Nhập mã giảm giá")
    if (Number(form.max) > 0 && Number(form.min) > Number(form.max)) return toast.error("Min không được lớn hơn max")
    onSubmit(form)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader><DialogTitle>{coupon ? "Sửa mã giảm giá" : "Thêm mã giảm giá"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Mã giảm giá">
            <div className="flex gap-2"><Input value={form.code} onChange={(event) => setField("code", event.target.value.toUpperCase())} placeholder="VD: SALE2026" /><Button type="button" variant="outline" onClick={() => setField("code", generateCouponCode())}>Ngẫu nhiên</Button></div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Số lượt"><Input type="number" min="1" value={form.amount} onChange={(event) => setField("amount", event.target.value)} /></Field>
            <Field label="Giảm (%)"><Input type="number" min="0" max="100" value={form.discount} onChange={(event) => setField("discount", event.target.value)} /></Field>
            <Field label="Đơn tối thiểu"><Input type="number" min="0" value={form.min} onChange={(event) => setField("min", event.target.value)} /></Field>
            <Field label="Đơn tối đa"><Input type="number" min="0" value={form.max} onChange={(event) => setField("max", event.target.value)} /></Field>
          </div>
          <Field label="Áp dụng cho dịch vụ">
            <SelectCustom value={form.scope} onValueChange={(value) => setField("scope", value as CouponScope)} options={SCOPE_OPTIONS} />
          </Field>
          <p className="text-xs text-muted-foreground">Đơn tối đa = 0 nghĩa là không giới hạn. Chọn toàn bộ dịch vụ để mã dùng ở mọi nơi có component mã giảm giá.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button><Button onClick={handleSubmit} disabled={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
}

function Pagination({ page, setPage, limit, setLimit, total, totalPages, startRow, endRow }: { page: number; setPage: (p: number | ((prev: number) => number)) => void; limit: number; setLimit: (n: number) => void; total: number; totalPages: number; startRow: number; endRow: number }) {
  return <div className="flex flex-col items-center justify-between gap-4 sm:flex-row"><p className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} mã</p><div className="flex items-center gap-3"><SelectCustom value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1) }} size="sm" className="w-20" options={["10", "20", "50", "100"].map((v) => ({ value: v, label: v }))} /><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Trước</Button><span className="text-sm text-muted-foreground">{page} / {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Sau</Button></div></div>
}

function ChevronRight() {
  return <span className="text-muted-foreground/50">/</span>
}
