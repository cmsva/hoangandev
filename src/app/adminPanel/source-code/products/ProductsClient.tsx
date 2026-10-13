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

export function AdminProductsClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [deleting, setDeleting] = useState<any | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: cats } = useQuery(
    trpc.adminProduct.categoriesForSelect.queryOptions()
  ) as { data: any[] | undefined }

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminProduct.listProducts.queryOptions({
      page,
      limit,
      keyword: keyword || undefined,
      categoryId: categoryId || undefined,
      status: statusFilter !== "" ? Number(statusFilter) : undefined,
    })
  ) as { data: any; isLoading: boolean; isFetching: boolean }

  const items: any[] = data?.items ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  const deleteMut = useMutation({
    ...trpc.adminProduct.deleteProduct.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa mã nguồn")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminProduct.listProducts.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminProduct.bulkDeleteProducts.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} sản phẩm`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminProduct.listProducts.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })


  const categoryOptions = [
    { value: "", label: "Tất cả danh mục" },
    ...(cats ?? []).map((c) => ({ value: c.id, label: c.name })),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a>
            <ChevronRight />
            <span>Mã nguồn</span>
            <ChevronRight />
            <span className="text-foreground">Sản phẩm</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600">
              <IconBracketsCurly size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sản phẩm mã nguồn</h1>
              <p className="text-sm text-muted-foreground">
                Quản lý kho mã nguồn bán cho khách. Hỗ trợ ảnh bìa, gallery, mô tả HTML và file tải.
              </p>
            </div>
          </div>
        </div>
        <Link
          href="/adminPanel/source-code/products/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
        >
          <PlusIcon /> Thêm mã nguồn
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <SearchIcon />
          <input
            type="text"
            placeholder="Tìm theo tên..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          {isFetching && !isLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          )}
        </div>
        <SelectCustom
          value={categoryId}
          onValueChange={(v) => { setCategoryId(v); setPage(1) }}
          className="w-full sm:w-[200px]"
          options={categoryOptions}
        />
        <SelectCustom
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v); setPage(1) }}
          className="w-full sm:w-[160px]"
          options={[
            { value: "", label: "Tất cả trạng thái" },
            { value: "1", label: "Hiển thị" },
            { value: "0", label: "Ẩn" },
          ]}
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Ảnh</TableHead>
              <TableHead>Tên / Slug</TableHead>
              <TableHead>Danh mục</TableHead>
              <TableHead className="text-right">Giá</TableHead>
              <TableHead className="text-center">Đã bán</TableHead>
              <TableHead className="text-center">Lượt xem</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Tạo lúc</TableHead>
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
              items.map((p: any, i: number) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">{startRow + i}</span>
                  </TableCell>
                  <TableCell>
                    <div className="h-12 w-12 rounded-md overflow-hidden bg-muted border shrink-0">
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbnail} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">No img</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-[180px] max-w-[300px]">
                      <Link href={`/adminPanel/source-code/products/${p.id}/edit`} className="text-sm font-semibold hover:text-primary transition-colors line-clamp-2">
                        {p.title}
                      </Link>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{p.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{p.category?.name ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {p.isFree ? (
                      <span className="text-emerald-600 font-bold text-sm">FREE</span>
                    ) : p.salePrice ? (
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold tabular-nums">{formatMoney(p.salePrice)}</span>
                        <span className="text-[10px] text-muted-foreground line-through tabular-nums">{formatMoney(p.price)}</span>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold tabular-nums">{formatMoney(p.price)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="rounded-full bg-emerald-500/15 text-emerald-600 px-2 py-0.5 text-[11px] font-bold tabular-nums">
                      {p.salesCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs text-muted-foreground tabular-nums">{p.view}</span>
                  </TableCell>
                  <TableCell>
                    {p.status === 1 ? (
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Hiển thị</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">Ẩn</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(p.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/adminPanel/source-code/products/${p.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 px-2.5 h-8 text-xs font-medium hover:bg-primary/20 transition-all"
                      >
                        <EditIcon /> Sửa
                      </Link>
                      <button
                        onClick={() => setDeleting(p)}
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
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  Chưa có mã nguồn nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {items.map((p: any) => (
          <div key={p.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex gap-3">
              <div className="h-16 w-16 rounded-md overflow-hidden bg-muted border shrink-0">
                {p.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/adminPanel/source-code/products/${p.id}/edit`} className="text-sm font-semibold line-clamp-2 hover:text-primary">
                  {p.title}
                </Link>
                <p className="text-[11px] text-muted-foreground mt-0.5">{p.category?.name ?? "—"}</p>
                <p className="text-sm font-semibold mt-1">
                  {p.isFree ? <span className="text-emerald-600">FREE</span> : formatMoney(p.salePrice ?? p.price)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/adminPanel/source-code/products/${p.id}/edit`}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary h-8 text-xs font-medium"
              >
                <EditIcon /> Sửa
              </Link>
              <button
                onClick={() => setDeleting(p)}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-rose-500/10 text-rose-600 h-8 text-xs font-medium"
              >
                <TrashIcon /> Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">
            Hiển thị {startRow}-{endRow} / {total} mã nguồn
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

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa mã nguồn"
        description={`Xóa "${deleting?.title}"? Sẽ không thể xóa nếu đã có đơn mua. Khuyến nghị: ẩn (status=0) thay thế.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}

function ChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg>
}
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
}
function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg>
}
function EditIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
}
function TrashIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
}
