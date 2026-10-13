"use client"

import { useBulkSelect } from "@/hooks/use-bulk-select"
import { BulkActionBar, BulkSelectHead, BulkSelectCell } from "@/components/admin/bulk-action-bar"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SelectCustom } from "@/components/ui/select-custom"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { toast } from "@/components/ui/toast"
import { IconDocument } from "@/components/icons"

function formatDateTime(input: unknown): string {
  if (!input) return "—"
  const date = new Date(input as string)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
}

export function AdminPostsClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [deleting, setDeleting] = useState<any | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => { setKeyword(searchInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data: cats } = useQuery(trpc.adminPost.categoriesForSelect.queryOptions()) as { data: any[] | undefined }
  const { data, isLoading, isFetching } = useQuery(trpc.adminPost.listPosts.queryOptions({ page, limit, keyword: keyword || undefined, categoryId: categoryId || undefined, status: statusFilter !== "" ? Number(statusFilter) : undefined })) as { data: any; isLoading: boolean; isFetching: boolean }

  const items: any[] = data?.items ?? []
  const total = Number(data?.total ?? 0)
  const totalPages = Number(data?.totalPages ?? 1)
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  const deleteMut = useMutation({
    ...trpc.adminPost.deletePost.mutationOptions(),
    onSuccess: () => { toast.success("Đã xóa bài viết"); setDeleting(null); qc.invalidateQueries({ queryKey: trpc.adminPost.listPosts.queryKey() }) },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminPost.bulkDeletePosts.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} bài viết`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminPost.listPosts.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground"><a href="/adminPanel/dashboard" className="hover:text-foreground">Admin</a><span>/</span><span>Bài viết</span><span>/</span><span className="text-foreground">Danh sách post</span></nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600"><IconDocument size={20} /></div>
            <div><h1 className="text-2xl font-bold tracking-tight">Danh sách post</h1><p className="text-sm text-muted-foreground">Quản lý bài viết, SEO title, mô tả và từ khóa.</p></div>
          </div>
        </div>
        <Link href="/adminPanel/posts/write" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90">+ Viết bài mới</Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm theo tiêu đề..." className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
          {isFetching && !isLoading && <span className="absolute right-3 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}
        </div>
        <SelectCustom value={categoryId} onValueChange={(value) => { setCategoryId(value); setPage(1) }} className="w-full sm:w-[200px]" options={[{ value: "", label: "Tất cả chuyên mục" }, ...(cats ?? []).map((cat) => ({ value: cat.id, label: cat.name }))]} />
        <SelectCustom value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1) }} className="w-full sm:w-[160px]" options={[{ value: "", label: "Tất cả trạng thái" }, { value: "1", label: "Hiển thị" }, { value: "0", label: "Ẩn" }]} />
      </div>

      <div className="hidden rounded-md border md:block">
        <Table><TableHeader><TableRow><BulkSelectHead checked={bulk.isAllSelected} onChange={bulk.toggleAll} /><TableHead className="w-[60px]">#</TableHead><TableHead>Ảnh</TableHead><TableHead>Tiêu đề / Slug</TableHead><TableHead>Chuyên mục</TableHead><TableHead className="text-center">View</TableHead><TableHead>Trạng thái</TableHead><TableHead>Tạo lúc</TableHead><TableHead className="text-end">Thao tác</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, index) => <TableRow key={index}>{Array.from({ length: 9 }).map((__, cell) => <TableCell key={cell}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : items.length > 0 ? items.map((post, index) => (
              <TableRow key={post.id}><BulkSelectCell checked={bulk.isSelected(post.id)} onChange={() => bulk.toggle(post.id)} /><TableCell className="font-mono text-sm text-muted-foreground">{startRow + index}</TableCell><TableCell><div className="h-12 w-16 overflow-hidden rounded-md border bg-muted">{post.thumbnail ? <img src={post.thumbnail} alt={post.title} loading="lazy" className="h-full w-full object-cover" /> : null}</div></TableCell><TableCell><Link href={`/adminPanel/posts/${post.id}/edit`} className="text-sm font-semibold hover:text-primary line-clamp-2">{post.title}</Link><p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{post.slug}</p>{post.featured && <span className="mt-1 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">Nổi bật</span>}</TableCell><TableCell className="text-xs text-muted-foreground">{post.category?.name ?? "—"}</TableCell><TableCell className="text-center text-xs tabular-nums text-muted-foreground">{post.view}</TableCell><TableCell>{post.status === 1 ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-600">Hiển thị</span> : <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-600">Ẩn</span>}</TableCell><TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(post.createdAt)}</TableCell><TableCell className="text-end"><div className="flex justify-end gap-1.5"><Link href={`/adminPanel/posts/${post.id}/edit`} className="rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/20">Sửa</Link><button onClick={() => setDeleting(post)} className="rounded-md bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-600 ring-1 ring-rose-500/20">Xóa</button></div></TableCell></TableRow>
            )) : <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Chưa có bài viết nào.</TableCell></TableRow>}
          </TableBody></Table>
      </div>
      <div className="space-y-3 md:hidden">
        {items.map((post) => <div key={post.id} className="rounded-lg border bg-card p-4 space-y-3"><Link href={`/adminPanel/posts/${post.id}/edit`} className="text-sm font-semibold hover:text-primary line-clamp-2">{post.title}</Link><p className="text-xs text-muted-foreground">{post.category?.name ?? "—"} • {formatDateTime(post.createdAt)}</p><div className="flex gap-2"><Link href={`/adminPanel/posts/${post.id}/edit`} className="flex-1 rounded-md bg-primary/10 py-2 text-center text-xs font-medium text-primary">Sửa</Link><button onClick={() => setDeleting(post)} className="flex-1 rounded-md bg-rose-500/10 py-2 text-xs font-medium text-rose-600">Xóa</button></div></div>)}
      </div>

      {!isLoading && total > 0 && <div className="flex flex-col items-center justify-between gap-4 sm:flex-row"><div className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} bài viết</div><div className="flex items-center gap-4"><SelectCustom value={String(limit)} onValueChange={(value) => { setLimit(Number(value)); setPage(1) }} size="sm" className="w-[80px]" options={[{ value: "10", label: "10" }, { value: "20", label: "20" }, { value: "50", label: "50" }]} /><div className="flex items-center gap-1"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="h-8 rounded-md border bg-background px-3 text-sm disabled:opacity-50">Trước</button><span className="px-2 text-sm text-muted-foreground">{page} / {totalPages}</span><button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="h-8 rounded-md border bg-background px-3 text-sm disabled:opacity-50">Sau</button></div></div></div>}

      <BulkActionBar selectedCount={bulk.selectedCount} onClearAll={bulk.clearAll} onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })} isPending={bulkDeleteMut.isPending} entityLabel="bài viết" />

      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Xóa bài viết" description={`Xóa bài viết "${deleting?.title}"? Hành động không thể hoàn tác.`} variant="destructive" confirmText="Xóa" cancelText="Hủy" isPending={deleteMut.isPending} onConfirm={() => deleteMut.mutate({ id: deleting.id })} />
    </div>
  )
}
