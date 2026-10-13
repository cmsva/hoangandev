"use client"

import { useBulkSelect } from "@/hooks/use-bulk-select"
import { BulkActionBar, BulkSelectHead, BulkSelectCell } from "@/components/admin/bulk-action-bar"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { IconMonitor } from "@/components/icons"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"

function formatDateTime(input: unknown): string {
  if (!input) return "-"
  const date = new Date(String(input))
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("vi-VN")
}

export function AdminWebsiteCategoriesClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<any | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => { setKeyword(searchInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(trpc.adminWebsite.listCategories.queryOptions({ page, limit, keyword: keyword || undefined })) as { data: any; isLoading: boolean; isFetching: boolean }
  const items: any[] = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  const deleteMut = useMutation({
    ...trpc.adminWebsite.deleteCategory.mutationOptions(),
    onSuccess: () => { toast.success("Đã xóa danh mục"); setDeleting(null); qc.invalidateQueries({ queryKey: trpc.adminWebsite.listCategories.queryKey() }) },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminWebsite.bulkDeleteCategories.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} danh mục`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminWebsite.listCategories.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground"><a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a><ChevronRight /><span>Website</span><ChevronRight /><span className="text-foreground">Danh mục</span></nav>
          <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600"><IconMonitor size={20} /></div><div><h1 className="text-2xl font-bold tracking-tight">Danh mục website</h1><p className="text-sm text-muted-foreground">Quản lý nhóm mẫu website cho khách thuê.</p></div></div>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"><PlusIcon /> Thêm danh mục</button>
      </div>

      <div className="relative max-w-sm"><SearchIcon /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm theo tên danh mục..." className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />{isFetching && !isLoading && <span className="absolute right-3 top-1/2 inline-block h-3 w-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}</div>

      <div className="hidden rounded-md border md:block"><Table><TableHeader><TableRow><BulkSelectHead checked={bulk.isAllSelected} onChange={bulk.toggleAll} /><TableHead className="w-[60px]">#</TableHead><TableHead>Tên danh mục</TableHead><TableHead>Slug</TableHead><TableHead>Trạng thái</TableHead><TableHead>Tạo lúc</TableHead><TableHead className="text-end">Thao tác</TableHead></TableRow></TableHeader><TableBody>{isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : items.length > 0 ? items.map((c, i) => <TableRow key={c.id}><BulkSelectCell checked={bulk.isSelected(c.id)} onChange={() => bulk.toggle(c.id)} /><TableCell><span className="font-mono text-sm text-muted-foreground">{startRow + i}</span></TableCell><TableCell className="font-semibold">{c.name}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{c.slug}</TableCell><TableCell>{c.status === 1 ? <Badge tone="green">Hiển thị</Badge> : <Badge tone="red">Ẩn</Badge>}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</TableCell><TableCell className="text-end"><RowActions onEdit={() => setEditing(c)} onDelete={() => setDeleting(c)} /></TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Chưa có danh mục.</TableCell></TableRow>}</TableBody></Table></div>

      <div className="space-y-3 md:hidden">{items.map((c) => <div key={c.id} className="rounded-lg border bg-card p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{c.name}</p><p className="font-mono text-xs text-muted-foreground">{c.slug}</p></div>{c.status === 1 ? <Badge tone="green">Hiển thị</Badge> : <Badge tone="red">Ẩn</Badge>}</div><div className="mt-3 flex gap-2"><button onClick={() => setEditing(c)} className="h-8 flex-1 rounded-md bg-primary/10 text-xs font-medium text-primary">Sửa</button><button onClick={() => setDeleting(c)} className="h-8 flex-1 rounded-md bg-rose-500/10 text-xs font-medium text-rose-600">Xóa</button></div></div>)}</div>

      {!isLoading && total > 0 && <Pagination page={page} setPage={setPage} limit={limit} setLimit={setLimit} total={total} totalPages={totalPages} startRow={startRow} endRow={endRow} label="danh mục" />}
      {(creating || editing) && <CategoryFormDialog editing={editing} onClose={() => { setCreating(false); setEditing(null) }} onSaved={() => qc.invalidateQueries({ queryKey: trpc.adminWebsite.listCategories.queryKey() })} />}
      <BulkActionBar selectedCount={bulk.selectedCount} onClearAll={bulk.clearAll} onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })} isPending={bulkDeleteMut.isPending} entityLabel="danh mục" />
      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Xóa danh mục" description={`Xóa danh mục "${deleting?.name}"?`} variant="destructive" confirmText="Xóa" cancelText="Hủy" isPending={deleteMut.isPending} onConfirm={() => deleteMut.mutate({ id: deleting.id })} />
    </div>
  )
}

function CategoryFormDialog({ editing, onClose, onSaved }: { editing: any | null; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const [name, setName] = useState(editing?.name ?? "")
  const [slug, setSlug] = useState(editing?.slug ?? "")
  const [status, setStatus] = useState<number>(editing?.status ?? 1)
  const createMut = useMutation({ ...trpc.adminWebsite.createCategory.mutationOptions(), onSuccess: () => { toast.success("Đã tạo danh mục"); onSaved(); onClose() }, onError: (err: any) => toast.error(err.message || "Tạo thất bại") })
  const updateMut = useMutation({ ...trpc.adminWebsite.updateCategory.mutationOptions(), onSuccess: () => { toast.success("Đã cập nhật"); onSaved(); onClose() }, onError: (err: any) => toast.error(err.message || "Cập nhật thất bại") })
  const isPending = createMut.isPending || updateMut.isPending
  const data = { name: name.trim(), slug: slug.trim() || undefined, status }
  return <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editing ? "Cập nhật danh mục" : "Thêm danh mục"}</DialogTitle></DialogHeader><div className="space-y-4 py-2"><Field label="Tên danh mục" value={name} onChange={setName} placeholder="VD: Web shop, Web dịch vụ..." /><Field label="Slug" value={slug} onChange={setSlug} placeholder="Tự sinh nếu để trống" /><div className="space-y-1.5"><label className="text-sm font-medium">Trạng thái</label><SelectCustom value={String(status)} onValueChange={(value) => setStatus(Number(value))} options={[{ value: "1", label: "Hiển thị" }, { value: "0", label: "Ẩn" }]} /></div></div><DialogFooter className="flex-row gap-2 sm:justify-end"><button onClick={onClose} disabled={isPending} className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">Hủy</button><button onClick={() => editing ? updateMut.mutate({ id: editing.id, data }) : createMut.mutate(data)} disabled={isPending || !data.name} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">{isPending ? "Đang lưu..." : "Lưu"}</button></DialogFooter></DialogContent></Dialog>
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <div className="space-y-1.5"><label className="text-sm font-medium">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" /></div> }
function Badge({ tone, children }: { tone: "green" | "red"; children: React.ReactNode }) { return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone === "green" ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"}`}>{children}</span> }
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { return <div className="flex items-center justify-end gap-1.5"><button onClick={onEdit} className="inline-flex h-8 items-center gap-1 rounded-md bg-primary/10 px-2.5 text-xs font-medium text-primary ring-1 ring-primary/20 hover:bg-primary/20"><EditIcon /> Sửa</button><button onClick={onDelete} className="inline-flex h-8 items-center gap-1 rounded-md bg-rose-500/10 px-2.5 text-xs font-medium text-rose-600 ring-1 ring-rose-500/20 hover:bg-rose-500/20"><TrashIcon /> Xóa</button></div> }
function Pagination({ page, setPage, limit, setLimit, total, totalPages, startRow, endRow, label }: { page: number; setPage: (value: number | ((prev: number) => number)) => void; limit: number; setLimit: (value: number) => void; total: number; totalPages: number; startRow: number; endRow: number; label: string }) { return <div className="flex flex-col items-center justify-between gap-4 sm:flex-row"><div className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} {label}</div><div className="flex items-center gap-4"><SelectCustom value={String(limit)} onValueChange={(value) => { setLimit(Number(value)); setPage(1) }} size="sm" className="w-[80px]" options={[{ value: "10", label: "10" }, { value: "20", label: "20" }, { value: "50", label: "50" }]} /><div className="flex items-center gap-1"><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 rounded-md border bg-background px-3 text-sm font-medium disabled:opacity-50">Trước</button><span className="px-2 text-sm text-muted-foreground">{page} / {totalPages}</span><button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 rounded-md border bg-background px-3 text-sm font-medium disabled:opacity-50">Sau</button></div></div></div> }
function ChevronRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m9 18 6-6-6-6" /></svg> }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg> }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg> }
function EditIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg> }
function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
