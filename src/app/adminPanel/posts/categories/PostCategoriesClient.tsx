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
import { IconBracketsCurly } from "@/components/icons"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(input: any) {
  if (!input) return "—"
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function AdminPostCategoriesClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const [editing, setEditing] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<any | null>(null)

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminPost.listCategories.queryOptions({
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
    ...trpc.adminPost.deleteCategory.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa chuyên mục")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminPost.listCategories.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminPost.bulkDeleteCategories.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} danh mục`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminPost.listCategories.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })


  return (
    <div className="space-y-6">
      {/* Breadcrumb + Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">
              Admin
            </a>
            <ChevronRight />
            <span>Bài viết</span>
            <ChevronRight />
            <span className="text-foreground font-normal">Danh mục</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600">
              <IconBracketsCurly size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Danh mục bài viết</h1>
              <p className="text-sm text-muted-foreground">
                Tổ chức bài viết theo chuyên mục để khách dễ theo dõi.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
        >
          <PlusIcon /> Thêm chuyên mục
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <SearchIcon />
        <input
          type="text"
          placeholder="Tìm theo tên chuyên mục..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs transition-colors placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        {isFetching && !isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Tên chuyên mục</TableHead>
              <TableHead className="text-center">Bài viết</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Tạo lúc</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((c: any, i: number) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">{startRow + i}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold">{c.name}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
                      {c.productCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    {c.status === 1 ? (
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                        Hiển thị
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                        Ẩn
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(c.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditing(c)}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 px-2.5 h-8 text-xs font-medium hover:bg-primary/20 transition-all"
                      >
                        <EditIcon /> Sửa
                      </button>
                      <button
                        onClick={() => setDeleting(c)}
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
                  Chưa có chuyên mục nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {items.map((c: any) => (
          <div key={c.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.name}</p>
              </div>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold shrink-0">
                {c.productCount}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(c)}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 h-8 text-xs font-medium"
              >
                <EditIcon /> Sửa
              </button>
              <button
                onClick={() => setDeleting(c)}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 h-8 text-xs font-medium"
              >
                <TrashIcon /> Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <Pagination
          page={page}
          setPage={setPage}
          limit={limit}
          setLimit={setLimit}
          total={total}
          totalPages={totalPages}
          startRow={startRow}
          endRow={endRow}
        />
      )}

      {/* Create / Edit modal */}
      {(creating || editing) && (
        <CategoryFormDialog
          editing={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: trpc.adminPost.listCategories.queryKey() })
            qc.invalidateQueries({ queryKey: trpc.adminPost.categoriesForSelect.queryKey() })
          }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa chuyên mục"
        description={`Xóa chuyên mục "${deleting?.name}"? Hành động không thể hoàn tác.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}

// ─── Form dialog (create/edit) ─────────────────────────────────────────────

function CategoryFormDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: any | null
  onClose: () => void
  onSaved: () => void
}) {
  const trpc = useTRPC()
  const isEdit = !!editing

  const [name, setName] = useState(editing?.name ?? "")
  const [status, setStatus] = useState<number>(editing?.status ?? 1)

  const createMut = useMutation({
    ...trpc.adminPost.createCategory.mutationOptions(),
    onSuccess: () => {
      toast.success("Tạo chuyên mục thành công")
      onSaved()
      onClose()
    },
    onError: (err: any) => toast.error(err.message || "Tạo thất bại"),
  })

  const updateMut = useMutation({
    ...trpc.adminPost.updateCategory.mutationOptions(),
    onSuccess: () => {
      toast.success("Cập nhật thành công")
      onSaved()
      onClose()
    },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })

  const isPending = createMut.isPending || updateMut.isPending

  function handleSubmit() {
    const data = {
      name: name.trim(),
      status,
    }
    if (!data.name) {
      toast.error("Vui lòng nhập tên")
      return
    }
    if (isEdit) {
      updateMut.mutate({ id: editing.id, data })
    } else {
      createMut.mutate(data)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Cập nhật chuyên mục" : "Thêm chuyên mục mới"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Tên chuyên mục <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Tin tức, Hướng dẫn..."
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Trạng thái</label>
            <SelectCustom
              value={String(status)}
              onValueChange={(v) => setStatus(Number(v))}
              options={[
                { value: "1", label: "Hiển thị" },
                { value: "0", label: "Ẩn" },
              ]}
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo mới"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Pagination({ page, setPage, limit, setLimit, total, totalPages, startRow, endRow }: {
  page: number
  setPage: (p: number | ((prev: number) => number)) => void
  limit: number
  setLimit: (n: number) => void
  total: number
  totalPages: number
  startRow: number
  endRow: number
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="text-sm text-muted-foreground">
        Hiển thị {startRow}-{endRow} / {total} danh mục
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
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
          >
            Trước
          </button>
          <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-8 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
          >
            Sau
          </button>
        </div>
      </div>
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
