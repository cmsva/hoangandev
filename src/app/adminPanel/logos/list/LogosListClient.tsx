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
import { ImageUploader } from "@/components/admin/image-uploader"
import { CKEditor } from "@/components/admin/ckeditor"
import { toast } from "@/components/ui/toast"
import { IconBrush } from "@/components/icons"
import { GenerateAiButton } from "@/components/admin/generate-ai-button"

function formatMoney(n: number | null | undefined) {
  const num = Number(n)
  return new Intl.NumberFormat("vi-VN").format(Number.isFinite(num) ? num : 0) + "đ"
}

export function AdminLogosClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
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

  const { data: cats } = useQuery(
    trpc.adminLogo.categoriesForSelect.queryOptions()
  ) as { data: any[] | undefined }

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminLogo.listLogos.queryOptions({
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
    ...trpc.adminLogo.deleteLogo.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa logo")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminLogo.listLogos.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminLogo.bulkDeleteLogos.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} logo`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminLogo.listLogos.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })


  const categoryOptions = [
    { value: "", label: "Tất cả danh mục" },
    ...(cats ?? []).map((c) => ({ value: c.id, label: c.name })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a>
            <ChevronRight />
            <span>Logo</span>
            <ChevronRight />
            <span className="text-foreground">Logo mẫu</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-pink-500/15 text-pink-600">
              <IconBrush size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Logo mẫu</h1>
              <p className="text-sm text-muted-foreground">Kho logo template cho khách thuê và custom shopName.</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
        >
          <PlusIcon /> Thêm logo
        </button>
      </div>

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
        <SelectCustom value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1) }} className="w-full sm:w-[200px]" options={categoryOptions} />
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

      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <BulkSelectHead checked={bulk.isAllSelected} onChange={bulk.toggleAll} />
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Ảnh</TableHead>
              <TableHead>Tên / Slug</TableHead>
              <TableHead>Danh mục</TableHead>
              <TableHead className="text-center">STT</TableHead>
              <TableHead className="text-right">Giá</TableHead>
              <TableHead className="text-center">Đã thuê</TableHead>
              <TableHead className="text-center">Lượt xem</TableHead>
              <TableHead>Trạng thái</TableHead>
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
              items.map((l: any, i: number) => (
                <TableRow key={l.id}>
                  <BulkSelectCell checked={bulk.isSelected(l.id)} onChange={() => bulk.toggle(l.id)} />
                  <TableCell><span className="font-mono text-sm text-muted-foreground">{startRow + i}</span></TableCell>
                  <TableCell>
                    <div className="h-12 w-12 rounded-md overflow-hidden bg-muted border shrink-0">
                      {l.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.image} alt={l.title} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">No img</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-[180px] max-w-[300px]">
                      <button onClick={() => setEditing(l)} className="text-sm font-semibold hover:text-primary transition-colors line-clamp-2 text-left w-full">
                        {l.title}
                      </button>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{l.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">{l.category?.name ?? "—"}</span></TableCell>
                  <TableCell className="text-center"><span className="font-mono text-xs text-muted-foreground">{l.stt}</span></TableCell>
                  <TableCell className="text-right">
                    {l.price === 0 ? (
                      <span className="text-emerald-600 font-bold text-sm">FREE</span>
                    ) : (
                      <span className="text-sm font-semibold tabular-nums">{formatMoney(l.price)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="rounded-full bg-emerald-500/15 text-emerald-600 px-2 py-0.5 text-[11px] font-bold tabular-nums">{l.salesCount}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs text-muted-foreground tabular-nums">{l.view}</span>
                  </TableCell>
                  <TableCell>
                    {l.status === 1 ? (
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Hiển thị</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">Ẩn</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setEditing(l)} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 px-2.5 h-8 text-xs font-medium hover:bg-primary/20 transition-all">
                        <EditIcon /> Sửa
                      </button>
                      <button onClick={() => setDeleting(l)} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 px-2.5 h-8 text-xs font-medium hover:bg-rose-500/20 transition-all">
                        <TrashIcon /> Xóa
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">Chưa có logo nào.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden grid grid-cols-2 gap-3">
        {items.map((l: any) => (
          <div key={l.id} className="rounded-lg border bg-card overflow-hidden">
            <div className="aspect-square bg-muted">
              {l.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image} alt={l.title} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="p-3 space-y-2">
              <p className="text-sm font-semibold line-clamp-2">{l.title}</p>
              <p className="text-sm font-bold text-primary">{l.price === 0 ? "FREE" : formatMoney(l.price)}</p>
              <div className="flex gap-1.5">
                <button onClick={() => setEditing(l)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary h-7 text-[11px] font-medium">
                  <EditIcon /> Sửa
                </button>
                <button onClick={() => setDeleting(l)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-rose-500/10 text-rose-600 h-7 text-[11px] font-medium">
                  <TrashIcon /> Xóa
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} logo</div>
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

      {(creating || editing) && cats && (
        <LogoFormDialog
          editingId={editing?.id ?? null}
          categories={cats}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => qc.invalidateQueries({ queryKey: trpc.adminLogo.listLogos.queryKey() })}
        />
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClearAll={bulk.clearAll}
        onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })}
        isPending={bulkDeleteMut.isPending}
        entityLabel="logo"
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa logo"
        description={`Xóa "${deleting?.title}"? Sẽ chặn nếu đã có khách thuê hoặc top 20% best-seller.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}

function LogoFormDialog({ editingId, categories, onClose, onSaved }: { editingId: string | null; categories: any[]; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const isEdit = !!editingId

  const { data: existing, isLoading: loadingExisting } = useQuery({
    ...trpc.adminLogo.getLogo.queryOptions({ id: editingId ?? "" }),
    enabled: isEdit,
  }) as { data: any; isLoading: boolean }

  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState("")
  const [content, setContent] = useState("")
  const [price, setPrice] = useState<number>(0)
  const [status, setStatus] = useState<number>(1)
  const [stt, setStt] = useState<number>(0)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate when editing data arrives
  useEffect(() => {
    if (isEdit && existing && !hydrated) {
      setTitle(existing.title ?? "")
      setSlug(existing.slug ?? "")
      setImage(existing.image ?? null)
      setCategoryId(existing.categoryId ?? "")
      setContent(existing.content ?? "")
      setPrice(existing.price ?? 0)
      setStatus(existing.status ?? 1)
      setStt(existing.stt ?? 0)
      setHydrated(true)
    } else if (!isEdit && !hydrated) {
      setHydrated(true)
    }
  }, [isEdit, existing, hydrated])

  const createMut = useMutation({
    ...trpc.adminLogo.createLogo.mutationOptions(),
    onSuccess: () => { toast.success("Tạo logo thành công"); onSaved(); onClose() },
    onError: (err: any) => toast.error(err.message || "Tạo thất bại"),
  })
  const updateMut = useMutation({
    ...trpc.adminLogo.updateLogo.mutationOptions(),
    onSuccess: () => { toast.success("Cập nhật thành công"); onSaved(); onClose() },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })
  const isPending = createMut.isPending || updateMut.isPending

  function handleSubmit() {
    if (!title.trim()) return toast.error("Vui lòng nhập tên logo")
    if (!categoryId) return toast.error("Vui lòng chọn danh mục")

    const data = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      image,
      categoryId,
      content: content || null,
      price: Math.max(0, Number(price) || 0),
      status,
      stt: Math.max(0, Number(stt) || 0),
    }
    if (isEdit) updateMut.mutate({ id: editingId!, data })
    else createMut.mutate(data)
  }

  if (isEdit && loadingExisting) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl">
          <DialogHeader><DialogTitle>Đang tải...</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Skeleton className="h-32 w-32 rounded-lg" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex flex-col gap-1 min-w-0">
            <span className="text-base font-semibold">{isEdit ? "Cập nhật logo" : "Thêm logo mới"}</span>
            {isEdit && existing?.title && (
              <span className="text-[13px] font-normal text-muted-foreground line-clamp-2 break-words" title={existing.title}>
                {existing.title}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <ImageUploader
                value={image}
                onChange={setImage}
                bucket="logos"
                label="Ảnh preview"
                hint="Tỉ lệ vuông đẹp nhất."
              />
            </div>
            <div className="md:col-span-2 space-y-3">
              <Field label="Tên logo" required>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Logo Cafe Premium" className={inputCls} />
              </Field>
              <Field label="Slug" hint="Để trống tự sinh">
                <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-from-title" className={`${inputCls} font-mono text-xs`} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Danh mục" required>
                  <SelectCustom
                    value={categoryId}
                    onValueChange={setCategoryId}
                    placeholder="Chọn..."
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </Field>
                <Field label="STT (sort)">
                  <input type="number" min={0} value={stt} onChange={(e) => setStt(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
                </Field>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá thuê (đ)" required hint="Đặt 0 = miễn phí">
              <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
            </Field>
            <Field label="Trạng thái">
              <SelectCustom
                value={String(status)}
                onValueChange={(v) => setStatus(Number(v))}
                options={[
                  { value: "1", label: "Hiển thị" },
                  { value: "0", label: "Ẩn" },
                ]}
              />
            </Field>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">Mô tả chi tiết (HTML)</label>
              <GenerateAiButton
                kind="rich_description"
                onApply={setContent}
                related={[
                  { label: "Loại", value: "Logo mẫu (template)" },
                  { label: "Tên logo", value: title },
                  { label: "Danh mục", value: categories.find((c) => c.id === categoryId)?.name || "" },
                ]}
                hintPlaceholder={`VD: Mô tả phong cách logo "${title || "..."}" — minimal/vintage/modern, phù hợp ngành nào, có thể custom shopName, designer custom 24h`}
                size="sm"
                label="Generated by AI"
              />
            </div>
            <CKEditor value={content} onChange={setContent} height={300} />
            <p className="text-[11px] text-muted-foreground">Hiển thị ở trang chi tiết logo. Mô tả phong cách / quốc gia / use case... Đây là logo mẫu, không có file sẵn — designer sẽ custom theo yêu cầu khách.</p>
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
