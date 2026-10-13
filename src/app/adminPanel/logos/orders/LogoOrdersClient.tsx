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
import { IconBrush } from "@/components/icons"

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Đang xử lý", color: "bg-yellow-500/15 text-yellow-600" },
  completed: { label: "Hoàn thành", color: "bg-emerald-500/15 text-emerald-600" },
  cancelled: { label: "Đã hủy", color: "bg-gray-500/15 text-gray-600" },
  cancelled_refund: { label: "Hủy hoàn tiền", color: "bg-blue-500/15 text-blue-600" },
  error_refund: { label: "Lỗi hoàn tiền", color: "bg-red-500/15 text-red-600" },
  suspended: { label: "Tạm khóa", color: "bg-purple-500/15 text-purple-600" },
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

export function AdminLogoOrdersClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
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
    trpc.adminLogo.listOrders.queryOptions({
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
    ...trpc.adminLogo.deleteOrder.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa đơn")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminLogo.listOrders.queryKey() })
      qc.invalidateQueries({ queryKey: trpc.adminLogo.listLogos.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminLogo.bulkDeleteOrders.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} đơn logo`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminLogo.listOrders.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })


  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a>
          <ChevronRight />
          <span>Logo</span>
          <ChevronRight />
          <span className="text-foreground">Đơn hàng</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-pink-500/15 text-pink-600">
            <IconBrush size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Đơn thuê Logo</h1>
            <p className="text-sm text-muted-foreground">Quản lý đơn thuê logo + tên shop khách yêu cầu custom.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <SearchIcon />
          <input
            type="text"
            placeholder="Tìm theo logo, shop, username..."
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
          className="w-full sm:w-[200px]"
          options={[{ value: "", label: "Tất cả trạng thái" }, ...STATUS_OPTIONS]}
        />
      </div>

      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <BulkSelectHead checked={bulk.isAllSelected} onChange={bulk.toggleAll} />
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Logo</TableHead>
              <TableHead>Khách</TableHead>
              <TableHead>Shop name</TableHead>
              <TableHead className="text-right">Giá</TableHead>
              <TableHead className="text-center">Đã tải</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Tạo lúc</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((o: any, i: number) => {
                const st = STATUS_LABELS[o.status] ?? { label: o.status, color: "bg-gray-500/10 text-gray-500" }
                return (
                  <TableRow key={o.id}>
                    <BulkSelectCell checked={bulk.isSelected(o.id)} onChange={() => bulk.toggle(o.id)} />
                    <TableCell><span className="font-mono text-sm text-muted-foreground">{startRow + i}</span></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5 max-w-[260px]">
                        <div className="h-9 w-9 rounded-md overflow-hidden bg-muted border shrink-0">
                          {o.logoImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.logoImage} alt={o.logoTitle} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <span className="text-sm font-medium line-clamp-1" title={o.logoTitle}>{o.logoTitle}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{o.user?.username ?? "—"}</span>
                        {o.user?.fullname && <span className="text-xs text-muted-foreground">{o.user.fullname}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{o.shopName}</span>
                      {o.customNote && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5" title={o.customNote}>{o.customNote}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-bold text-emerald-600 tabular-nums">{formatMoney(o.price)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-mono tabular-nums">{o.downloadCount}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{st.label}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(o.createdAt)}</span>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setEditing(o)} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 px-2.5 h-8 text-xs font-medium hover:bg-primary/20 transition-all">
                          <EditIcon /> Sửa
                        </button>
                        <button onClick={() => setDeleting(o)} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 px-2.5 h-8 text-xs font-medium hover:bg-rose-500/20 transition-all">
                          <TrashIcon /> Xóa
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Chưa có đơn nào.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {items.map((o: any) => {
          const st = STATUS_LABELS[o.status] ?? { label: o.status, color: "bg-gray-500/10 text-gray-500" }
          return (
            <div key={o.id} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{o.user?.username ?? "—"}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{st.label}</span>
              </div>
              <p className="text-sm line-clamp-1">{o.logoTitle}</p>
              <p className="text-xs text-muted-foreground">Shop: {o.shopName}</p>
              <p className="text-sm font-bold text-emerald-600 tabular-nums">{formatMoney(o.price)}</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(o)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary h-8 text-xs font-medium">
                  <EditIcon /> Sửa
                </button>
                <button onClick={() => setDeleting(o)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-rose-500/10 text-rose-600 h-8 text-xs font-medium">
                  <TrashIcon /> Xóa
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} đơn</div>
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
        <LogoOrderEditDialog
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: trpc.adminLogo.listOrders.queryKey() })}
        />
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClearAll={bulk.clearAll}
        onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })}
        isPending={bulkDeleteMut.isPending}
        entityLabel="đơn logo"
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa đơn logo"
        description={`Xóa đơn của ${deleting?.user?.username ?? "[user]"}? Hành động không thể hoàn tác. Lượt thuê của logo sẽ giảm 1.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}

function LogoOrderEditDialog({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const [status, setStatus] = useState(order.status)
  const [shopName, setShopName] = useState(order.shopName ?? "")
  const [customNote, setCustomNote] = useState(order.customNote ?? "")
  const [price, setPrice] = useState<number>(order.price ?? 0)
  const [deliveryUrl, setDeliveryUrl] = useState(order.deliveryUrl ?? "")
  const [deliveryNote, setDeliveryNote] = useState(order.deliveryNote ?? "")

  const updateMut = useMutation({
    ...trpc.adminLogo.updateOrder.mutationOptions(),
    onSuccess: () => { toast.success("Cập nhật thành công"); onSaved(); onClose() },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })

  function handleSubmit() {
    if (status === "completed" && !deliveryUrl.trim()) {
      toast.error("Vui lòng nhập link giao file trước khi chuyển sang Hoàn thành")
      return
    }
    updateMut.mutate({
      id: order.id,
      data: {
        status,
        shopName: shopName.trim(),
        customNote: customNote.trim() || null,
        price: Number(price) || 0,
        deliveryUrl: deliveryUrl.trim() || null,
        deliveryNote: deliveryNote.trim() || null,
      },
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !updateMut.isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex flex-col gap-1 min-w-0">
            <span className="text-base font-semibold">Sửa đơn logo</span>
            <span className="text-[13px] font-normal text-muted-foreground line-clamp-2 break-words" title={order.logoTitle}>
              {order.logoTitle}
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
              <span className="text-muted-foreground shrink-0">Đã tải</span>
              <span className="font-semibold tabular-nums text-right">{order.downloadCount} lần</span>
            </div>
          </div>

          {/* Yeu cau cua khach */}
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-500">Yêu cầu từ khách</p>
            <p className="text-sm font-semibold">{order.shopName}</p>
            {order.customNote && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{order.customNote}</p>
            )}
          </div>

          <Field label="Trạng thái" required>
            <SelectCustom value={status} onValueChange={(v: string) => setStatus(v)} options={STATUS_OPTIONS} />
          </Field>

          <Field label="Tên shop / brand" required>
            <input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="VD: Cafe ABC" className={inputCls} />
          </Field>

          <Field label="Ghi chú custom" hint="Color, line 2/3...">
            <textarea
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="VD: Màu đỏ, font đậm..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </Field>

          <Field label="Giá đơn (đ)">
            <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
          </Field>

          {/* Bàn giao file — designer / admin nhập khi hoàn thành */}
          <div className="space-y-3 rounded-md border-2 border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
              </span>
              <h3 className="text-sm font-bold">Bàn giao file cho khách</h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Designer hoàn thành logo → dán link Drive/Mega vào đây và chuyển trạng thái sang <b>Hoàn thành</b>.
              Khách sẽ thấy nút tải về ở trang Đơn của tôi.
            </p>
            <Field label="Link file giao" hint="Bắt buộc khi chuyển sang Hoàn thành">
              <input
                type="text"
                value={deliveryUrl}
                onChange={(e) => setDeliveryUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className={`${inputCls} font-mono text-xs`}
              />
            </Field>
            <Field label="Note giao khách (optional)">
              <textarea
                rows={2}
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="VD: Gồm PNG + PSD + AI. Mật khẩu file: 123456"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </Field>
          </div>
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
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg> }
function EditIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg> }
function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
