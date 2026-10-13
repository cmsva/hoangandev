"use client"

import { useBulkSelect } from "@/hooks/use-bulk-select"
import { BulkActionBar, BulkSelectHead, BulkSelectCell } from "@/components/admin/bulk-action-bar"

import { useEffect, useState } from "react"
import Link from "next/link"
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
import { IconBracketsCurly } from "@/components/icons"

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

export function AdminProductOrdersClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
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
    trpc.adminProduct.listOrders.queryOptions({
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
    ...trpc.adminProduct.deleteOrder.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa đơn")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminProduct.listOrders.queryKey() })
      qc.invalidateQueries({ queryKey: trpc.adminProduct.listProducts.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminProduct.bulkDeleteOrders.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} đơn hàng`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminProduct.listOrders.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })


  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a>
          <ChevronRight />
          <span>Mã nguồn</span>
          <ChevronRight />
          <span className="text-foreground">Đơn hàng</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600">
            <IconBracketsCurly size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Đơn hàng mã nguồn</h1>
            <p className="text-sm text-muted-foreground">
              Lịch sử mua mã nguồn của thành viên. Cho phép sửa giá / ngày và xóa đơn.
            </p>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon />
        <input
          type="text"
          placeholder="Tìm theo username hoặc tên mã nguồn..."
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
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Mã nguồn</TableHead>
              <TableHead className="text-right">Giá</TableHead>
              <TableHead>Ngày mua</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((o: any, i: number) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">{startRow + i}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{o.user?.username ?? "—"}</span>
                      {o.user?.fullname && (
                        <span className="text-xs text-muted-foreground">{o.user.fullname}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {o.product ? (
                      <Link href={`/adminPanel/source-code/products/${o.product.id}/edit`} className="flex items-center gap-2.5 hover:text-primary transition-colors">
                        <div className="h-9 w-9 rounded-md overflow-hidden bg-muted border shrink-0">
                          {o.product.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.product.thumbnail} alt={o.product.title} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <span className="text-sm font-medium line-clamp-1">{o.product.title}</span>
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">[đã xóa]</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">
                      {formatMoney(o.totalPrice)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(o.orderDate)}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditing(o)}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 px-2.5 h-8 text-xs font-medium hover:bg-primary/20 transition-all"
                      >
                        <EditIcon /> Sửa
                      </button>
                      <button
                        onClick={() => setDeleting(o)}
                        className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 px-2.5 h-8 text-xs font-medium hover:bg-rose-500/20 transition-all"
                      >
                        <TrashIcon /> Xóa
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Chưa có đơn hàng nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {items.map((o: any) => (
          <div key={o.id} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{o.user?.username ?? "—"}</span>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {formatDateTime(o.orderDate)}
              </span>
            </div>
            <p className="text-sm">
              {o.product?.title ?? <span className="text-muted-foreground italic">[đã xóa]</span>}
            </p>
            <p className="text-sm font-bold text-emerald-600 tabular-nums">
              {formatMoney(o.totalPrice)}
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(o)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary h-8 text-xs font-medium">
                <EditIcon /> Sửa
              </button>
              <button onClick={() => setDeleting(o)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-rose-500/10 text-rose-600 h-8 text-xs font-medium">
                <TrashIcon /> Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">
            Hiển thị {startRow}-{endRow} / {total} đơn
          </div>
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
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Trước
              </button>
              <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <OrderEditDialog
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: trpc.adminProduct.listOrders.queryKey() })}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa đơn mã nguồn"
        description={`Xóa đơn của ${deleting?.user?.username ?? "[user]"}? Hành động không thể hoàn tác. Số lượng đã bán của mã nguồn sẽ giảm 1.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}

function OrderEditDialog({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const [totalPrice, setTotalPrice] = useState<number>(order.totalPrice ?? 0)
  const [orderDate, setOrderDate] = useState<string>(toDateTimeInputValue(order.orderDate))

  const updateMut = useMutation({
    ...trpc.adminProduct.updateOrder.mutationOptions(),
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
        totalPrice: Number(totalPrice) || 0,
        orderDate: orderDate || undefined,
      },
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !updateMut.isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex flex-col gap-1 min-w-0">
            <span className="text-base font-semibold">Sửa đơn mã nguồn</span>
            <span
              className="text-[13px] font-normal text-muted-foreground line-clamp-2 break-words"
              title={order.product?.title ?? "[đã xóa]"}
            >
              {order.product?.title ?? "[đã xóa]"}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted/40 border p-3 space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Khách</span>
              <span className="font-semibold truncate text-right">{order.user?.username ?? "—"}</span>
            </div>
            {order.product && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Mã nguồn</span>
                <span
                  className="font-medium line-clamp-2 text-right break-words"
                  title={order.product.title}
                >
                  {order.product.title}
                </span>
              </div>
            )}
          </div>

          <Field label="Giá đơn (đ)" required>
            <input
              type="number"
              min={0}
              value={totalPrice}
              onChange={(e) => setTotalPrice(Number(e.target.value) || 0)}
              className={`${inputCls} tabular-nums`}
            />
          </Field>

          <Field label="Ngày mua">
            <input
              type="datetime-local"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className={inputCls}
            />
          </Field>
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
      <label className="text-sm font-medium block">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function ChevronRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg> }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg> }
function EditIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg> }
function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
