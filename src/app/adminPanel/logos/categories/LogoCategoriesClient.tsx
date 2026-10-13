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

function formatDateTime(input: any) {
  if (!input) return "—"
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AdminLogoCategoriesClient() {
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
    trpc.adminLogo.listCategories.queryOptions({
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
    ...trpc.adminLogo.deleteCategory.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa danh mục")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminLogo.listCategories.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminLogo.bulkDeleteCategories.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} danh mục`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminLogo.listCategories.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a>
            <ChevronRight />
            <span>Logo</span>
            <ChevronRight />
            <span className="text-foreground">Danh mục</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-pink-500/15 text-pink-600">
              <IconBrush size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Danh mục Logo</h1>
              <p className="text-sm text-muted-foreground">
                Phân loại logo theo nhóm để khách dễ tìm.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
        >
          <PlusIcon /> Thêm danh mục
        </button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon />
        <input
          type="text"
          placeholder="Tìm theo tên danh mục..."
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
              <TableHead>Tên danh mục</TableHead>
              <TableHead className="text-center">Số logo</TableHead>
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
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((c: any, i: number) => (
                <TableRow key={c.id}>
                  <BulkSelectCell checked={bulk.isSelected(c.id)} onChange={() => bulk.toggle(c.id)} />
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">{startRow + i}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold">{c.name}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
                      {c.logoCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    {c.status === 1 ? (
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Hiển thị</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">Ẩn</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(c.createdAt)}</span>
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
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Chưa có danh mục nào.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {items.map((c: any) => (
          <div key={c.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate">{c.name}</span>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold shrink-0">{c.logoCount}</span>
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
        ))}
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} danh mục</div>
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
        <CategoryFormDialog
          editing={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: trpc.adminLogo.listCategories.queryKey() })
            qc.invalidateQueries({ queryKey: trpc.adminLogo.categoriesForSelect.queryKey() })
          }}
        />
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClearAll={bulk.clearAll}
        onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })}
        isPending={bulkDeleteMut.isPending}
        entityLabel="danh mục"
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa danh mục"
        description={`Xóa "${deleting?.name}"? Sẽ chặn nếu còn logo trong danh mục.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}

function CategoryFormDialog({ editing, onClose, onSaved }: { editing: any | null; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const isEdit = !!editing
  const [name, setName] = useState(editing?.name ?? "")
  const [status, setStatus] = useState<number>(editing?.status ?? 1)

  const createMut = useMutation({
    ...trpc.adminLogo.createCategory.mutationOptions(),
    onSuccess: () => { toast.success("Tạo thành công"); onSaved(); onClose() },
    onError: (err: any) => toast.error(err.message || "Tạo thất bại"),
  })
  const updateMut = useMutation({
    ...trpc.adminLogo.updateCategory.mutationOptions(),
    onSuccess: () => { toast.success("Cập nhật thành công"); onSaved(); onClose() },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })
  const isPending = createMut.isPending || updateMut.isPending

  function handleSubmit() {
    const data = { name: name.trim(), status }
    if (!data.name) {
      toast.error("Vui lòng nhập tên")
      return
    }
    if (isEdit) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader className="min-w-0">
          <DialogTitle>{isEdit ? "Cập nhật danh mục" : "Thêm danh mục mới"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tên danh mục <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Cafe, Spa, Tech..."
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
          <button onClick={onClose} disabled={isPending} className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">Hủy</button>
          <button onClick={handleSubmit} disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {isPending ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo mới"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChevronRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg> }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg> }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg> }
function EditIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg> }
function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
