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
import { IconLink } from "@/components/icons"

function formatMoney(n: number | null | undefined) {
  const num = Number(n)
  return new Intl.NumberFormat("vi-VN").format(Number.isFinite(num) ? num : 0) + "đ"
}

export function AdminDomainPricingClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const [editing, setEditing] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<any | null>(null)
  const [configOpen, setConfigOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminDomain.listTlds.queryOptions({
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
    ...trpc.adminDomain.deleteTld.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa TLD")
      setDeleting(null)
      qc.invalidateQueries({ queryKey: trpc.adminDomain.listTlds.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Xóa thất bại"),
  })
  const bulk = useBulkSelect(items)
  const bulkDeleteMut = useMutation({
    ...trpc.adminDomain.bulkDeleteTlds.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} TLD`); bulk.clearAll(); qc.invalidateQueries({ queryKey: trpc.adminDomain.listTlds.queryKey() }) },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <a href="/adminPanel/dashboard" className="hover:text-foreground transition-colors">Admin</a>
            <ChevronRight />
            <span>Tên miền</span>
            <ChevronRight />
            <span className="text-foreground">Bảng giá</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600">
              <IconLink size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Bảng giá tên miền</h1>
              <p className="text-sm text-muted-foreground">
                Quản lý TLD và giá đăng ký / gia hạn cho khách.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => setConfigOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border bg-background px-4 text-sm font-bold shadow-sm transition-opacity hover:bg-accent"
          >
            Spaceship API
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
          >
            <PlusIcon /> Thêm TLD
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon />
        <input
          type="text"
          placeholder="Tìm TLD (com, net, vn...)..."
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
              <TableHead>TLD</TableHead>
              <TableHead className="text-right">Giá đăng ký</TableHead>
              <TableHead className="text-right">Giá gia hạn</TableHead>
              <TableHead className="text-right">Vốn đăng ký</TableHead>
              <TableHead className="text-right">Vốn gia hạn</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead className="text-center">Đang dùng</TableHead>
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
              items.map((t: any, i: number) => (
                <TableRow key={t.id}><BulkSelectCell checked={bulk.isSelected(t.id)} onChange={() => bulk.toggle(t.id)} />
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">{startRow + i}</span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-blue-500/10 text-blue-600 px-2.5 py-0.5 text-sm font-bold font-mono">
                      .{t.tld}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">{formatMoney(t.priceSold)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(t.renewSold)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-muted-foreground tabular-nums">{formatMoney(t.priceCost)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-muted-foreground tabular-nums">{formatMoney(t.renewCost)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className={t.provider === "spaceship" ? "inline-flex w-fit rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-600" : "inline-flex w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"}>{t.provider === "spaceship" ? "Spaceship" : "Đơn tay"}</span>
                      {t.provider === "spaceship" && <span className="text-[10px] text-muted-foreground">Mua: {t.autoRegisterEnabled ? "ON" : "OFF"} · Gia hạn: {t.autoRenewEnabled ? "ON" : "OFF"}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold">{t.activeOrders}</span>
                  </TableCell>
                  <TableCell>
                    {t.isActive ? (
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Bật bán</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">Tắt</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditing(t)}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary ring-1 ring-primary/20 px-2.5 h-8 text-xs font-medium hover:bg-primary/20 transition-all"
                      >
                        <EditIcon /> Sửa
                      </button>
                      <button
                        onClick={() => setDeleting(t)}
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
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">Chưa có TLD nào.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {items.map((t: any) => (
          <div key={t.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-md bg-blue-500/10 text-blue-600 px-2.5 py-0.5 text-base font-bold font-mono">.{t.tld}</span>
              <div className="flex items-center gap-1.5">
                <span className={t.provider === "spaceship" ? "rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-600" : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"}>{t.provider === "spaceship" ? "Auto" : "Tay"}</span>
                {t.isActive ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Bật bán</span>
                ) : (
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">Tắt</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Đăng ký</p>
                <p className="font-bold text-emerald-600 tabular-nums mt-0.5">{formatMoney(t.priceSold)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gia hạn</p>
                <p className="font-semibold tabular-nums mt-0.5">{formatMoney(t.renewSold)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(t)}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary h-8 text-xs font-medium"
              >
                <EditIcon /> Sửa
              </button>
              <button
                onClick={() => setDeleting(t)}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-rose-500/10 text-rose-600 h-8 text-xs font-medium"
              >
                <TrashIcon /> Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">
            Hiển thị {startRow}-{endRow} / {total} TLD
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

      {configOpen && <SpaceshipConfigDialog onClose={() => setConfigOpen(false)} />}

      {(creating || editing) && (
        <TldFormDialog
          editing={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: trpc.adminDomain.listTlds.queryKey() })
          }}
        />
      )}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClearAll={bulk.clearAll}
        onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })}
        isPending={bulkDeleteMut.isPending}
        entityLabel="TLD"
      />


      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa TLD"
        description={`Xóa .${deleting?.tld}? Sẽ chặn nếu còn domain hoạt động dùng TLD này.`}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate({ id: deleting.id })}
      />
    </div>
  )
}

function TldFormDialog({ editing, onClose, onSaved }: { editing: any; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC()
  const isEdit = !!editing

  const [tld, setTld] = useState(editing?.tld ?? "")
  const [priceSold, setPriceSold] = useState<number>(editing?.priceSold ?? 0)
  const [renewSold, setRenewSold] = useState<number>(editing?.renewSold ?? 0)
  const [priceCost, setPriceCost] = useState<number>(editing?.priceCost ?? 0)
  const [renewCost, setRenewCost] = useState<number>(editing?.renewCost ?? 0)
  const [provider, setProvider] = useState<"manual" | "spaceship">(editing?.provider ?? "manual")
  const [providerTld, setProviderTld] = useState<string>(editing?.providerTld ?? "")
  const [autoRegisterEnabled, setAutoRegisterEnabled] = useState<boolean>(editing?.autoRegisterEnabled ?? false)
  const [autoRenewEnabled, setAutoRenewEnabled] = useState<boolean>(editing?.autoRenewEnabled ?? false)
  const [markupType, setMarkupType] = useState<"fixed" | "percent">(editing?.markupType ?? "fixed")
  const [markupValue, setMarkupValue] = useState<number>(editing?.markupValue ?? 0)
  const [isActive, setIsActive] = useState<boolean>(editing?.isActive ?? true)

  const createMut = useMutation({
    ...trpc.adminDomain.createTld.mutationOptions(),
    onSuccess: () => { toast.success("Tạo TLD thành công"); onSaved(); onClose() },
    onError: (err: any) => toast.error(err.message || "Tạo thất bại"),
  })
  const updateMut = useMutation({
    ...trpc.adminDomain.updateTld.mutationOptions(),
    onSuccess: () => { toast.success("Cập nhật thành công"); onSaved(); onClose() },
    onError: (err: any) => toast.error(err.message || "Cập nhật thất bại"),
  })
  const isPending = createMut.isPending || updateMut.isPending

  function handleSubmit() {
    const cleanTld = tld.toLowerCase().trim().replace(/^\./, "")
    if (!cleanTld) {
      toast.error("Vui lòng nhập TLD")
      return
    }
    const data = {
      tld: cleanTld,
      priceCost: Number(priceCost) || 0,
      renewCost: Number(renewCost) || 0,
      priceSold: Number(priceSold) || 0,
      renewSold: Number(renewSold) || 0,
      provider,
      providerTld: provider === "spaceship" ? providerTld.toLowerCase().trim().replace(/^\./, "") || cleanTld : null,
      autoRegisterEnabled: provider === "spaceship" ? autoRegisterEnabled : false,
      autoRenewEnabled: provider === "spaceship" ? autoRenewEnabled : false,
      markupType: provider === "spaceship" ? markupType : null,
      markupValue: Number(markupValue) || 0,
      isActive,
    }
    if (isEdit) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Cập nhật TLD .${editing.tld}` : "Thêm TLD mới"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="TLD" required hint="Không có dấu chấm đầu. VD: com, net, vn">
            <input
              type="text"
              value={tld}
              onChange={(e) => setTld(e.target.value)}
              placeholder="com"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá bán đăng ký (đ)" required>
              <input type="number" min={0} value={priceSold} onChange={(e) => setPriceSold(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
            </Field>
            <Field label="Giá bán gia hạn (đ)">
              <input type="number" min={0} value={renewSold} onChange={(e) => setRenewSold(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
            </Field>
            <Field label="Vốn đăng ký (đ)" hint="Internal only">
              <input type="number" min={0} value={priceCost} onChange={(e) => setPriceCost(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
            </Field>
            <Field label="Vốn gia hạn (đ)" hint="Internal only">
              <input type="number" min={0} value={renewCost} onChange={(e) => setRenewCost(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
            </Field>
          </div>
          <Field label="Provider" hint="TLD mới mặc định là đơn tay để tránh auto ngoài ý muốn.">
            <SelectCustom
              value={provider}
              onValueChange={(v) => setProvider(v as "manual" | "spaceship")}
              options={[
                { value: "manual", label: "Đơn tay" },
                { value: "spaceship", label: "Spaceship auto" },
              ]}
            />
          </Field>
          {provider === "spaceship" && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <Field label="Provider TLD" hint="Để trống sẽ dùng TLD bên trên.">
                <input type="text" value={providerTld} onChange={(e) => setProviderTld(e.target.value)} placeholder="com" className={`${inputCls} font-mono`} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Auto mua">
                  <SelectCustom value={autoRegisterEnabled ? "1" : "0"} onValueChange={(v) => setAutoRegisterEnabled(v === "1")} options={[{ value: "0", label: "Tắt" }, { value: "1", label: "Bật" }]} />
                </Field>
                <Field label="Auto gia hạn">
                  <SelectCustom value={autoRenewEnabled ? "1" : "0"} onValueChange={(v) => setAutoRenewEnabled(v === "1")} options={[{ value: "0", label: "Tắt" }, { value: "1", label: "Bật" }]} />
                </Field>
                <Field label="Kiểu markup">
                  <SelectCustom value={markupType} onValueChange={(v) => setMarkupType(v as "fixed" | "percent")} options={[{ value: "fixed", label: "VNĐ" }, { value: "percent", label: "%" }]} />
                </Field>
                <Field label="Markup">
                  <input type="number" min={0} value={markupValue} onChange={(e) => setMarkupValue(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
                </Field>
              </div>
            </div>
          )}
          <Field label="Trạng thái">
            <SelectCustom
              value={isActive ? "1" : "0"}
              onValueChange={(v) => setIsActive(v === "1")}
              options={[
                { value: "1", label: "Bật bán" },
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
      <label className="text-sm font-medium block">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
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

function SpaceshipConfigDialog({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery(trpc.adminDomain.getSpaceshipConfig.queryOptions()) as { data: any; isLoading: boolean }
  const [name, setName] = useState("Spaceship")
  const [apiKey, setApiKey] = useState("")
  const [apiSecret, setApiSecret] = useState("")
  const [contactId, setContactId] = useState("")
  const [autoRegisterEnabled, setAutoRegisterEnabled] = useState(false)
  const [autoRenewEnabled, setAutoRenewEnabled] = useState(false)
  const [markupType, setMarkupType] = useState<"fixed" | "percent">("fixed")
  const [markupValue, setMarkupValue] = useState(0)
  const [status, setStatus] = useState<"active" | "disabled">("disabled")
  const [notes, setNotes] = useState("")
  const [usdToVndRate, setUsdToVndRate] = useState(26000)
  const [syncSlugsText, setSyncSlugsText] = useState("")

  useEffect(() => {
    if (!data) return
    setName(data.name ?? "Spaceship")
    setContactId(data.contactId ?? "")
    setAutoRegisterEnabled(data.autoRegisterEnabled ?? false)
    setAutoRenewEnabled(data.autoRenewEnabled ?? false)
    setMarkupType(data.markupType ?? "fixed")
    setMarkupValue(data.markupValue ?? 0)
    setStatus(data.status ?? "disabled")
    setNotes(data.notes ?? "")
    setUsdToVndRate(data.usdToVndRate ?? 26000)
    setSyncSlugsText(Array.isArray(data.syncSlugs) ? data.syncSlugs.join(", ") : "")
  }, [data])

  const saveMut = useMutation({
    ...trpc.adminDomain.upsertSpaceshipConfig.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình Spaceship")
      qc.invalidateQueries({ queryKey: trpc.adminDomain.getSpaceshipConfig.queryKey() })
      onClose()
    },
    onError: (err: any) => toast.error(err.message || "Lưu thất bại"),
  })
  const testMut = useMutation({
    ...trpc.adminDomain.testSpaceshipConfig.mutationOptions(),
    onSuccess: (res: any) => toast.success(res.message || "Kết nối thành công"),
    onError: (err: any) => toast.error(err.message || "Test thất bại"),
  })
  const syncMut = useMutation({
    ...trpc.adminDomain.syncTldsFromSpaceship.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(`Đồng bộ xong: +${res.inserted} mới, ${res.updated} cập nhật, ${res.skipped} bỏ qua`)
      qc.invalidateQueries({ queryKey: trpc.adminDomain.listTlds.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Đồng bộ thất bại"),
  })
  const isPending = saveMut.isPending || testMut.isPending || syncMut.isPending

  function handleSave() {
    saveMut.mutate({
      name: name.trim() || "Spaceship",
      apiKey: apiKey.trim() || undefined,
      apiSecret: apiSecret.trim() || undefined,
      contactId: contactId.trim(),
      autoRegisterEnabled,
      autoRenewEnabled,
      markupType,
      markupValue: Number(markupValue) || 0,
      usdToVndRate: Number(usdToVndRate) || 26000,
      syncSlugs: syncSlugsText
        .split(/[\s,\n]+/)
        .map((s) => s.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean),
      status,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Cấu hình Spaceship API</DialogTitle></DialogHeader>
        {isLoading ? <Skeleton className="h-64 w-full" /> : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tên cấu hình"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
              <Field label="Trạng thái"><SelectCustom value={status} onValueChange={(v) => setStatus(v as "active" | "disabled")} options={[{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }]} /></Field>
            </div>
            <Field label="API Key" hint={data?.apiKey ? `Đã lưu: ${data.apiKey}` : "Bắt buộc khi tạo mới"}><input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Để trống nếu không đổi" className={inputCls} /></Field>
            <Field label="API Secret" hint={data?.apiSecret ? `Đã lưu: ${data.apiSecret}` : "Bắt buộc khi tạo mới"}><input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="Để trống nếu không đổi" className={inputCls} /></Field>
            <Field label="Contact ID" required><input value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Auto mua"><SelectCustom value={autoRegisterEnabled ? "1" : "0"} onValueChange={(v) => setAutoRegisterEnabled(v === "1")} options={[{ value: "0", label: "Tắt" }, { value: "1", label: "Bật" }]} /></Field>
              <Field label="Auto gia hạn"><SelectCustom value={autoRenewEnabled ? "1" : "0"} onValueChange={(v) => setAutoRenewEnabled(v === "1")} options={[{ value: "0", label: "Tắt" }, { value: "1", label: "Bật" }]} /></Field>
              <Field label="Markup mặc định"><SelectCustom value={markupType} onValueChange={(v) => setMarkupType(v as "fixed" | "percent")} options={[{ value: "fixed", label: "VNĐ" }, { value: "percent", label: "%" }]} /></Field>
              <Field label="Giá trị markup"><input type="number" min={0} value={markupValue} onChange={(e) => setMarkupValue(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} /></Field>
            </div>
            <Field label="Ghi chú"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" /></Field>
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-sky-600">Đồng bộ giá từ Spaceship</p>
              <Field label="Tỉ giá USD → VNĐ" hint="Dùng để quy đổi giá USD của Spaceship sang VNĐ.">
                <input type="number" min={1} value={usdToVndRate} onChange={(e) => setUsdToVndRate(Number(e.target.value) || 0)} className={`${inputCls} tabular-nums`} />
              </Field>
              <Field label="Danh sách đuôi đồng bộ" hint="Cách nhau bởi dấu phẩy. Để trống = dùng ~30 đuôi phổ biến mặc định. Đuôi nhiều phần dùng _ (vd: in_net = .in.net).">
                <textarea rows={3} value={syncSlugsText} onChange={(e) => setSyncSlugsText(e.target.value)} placeholder="com, net, org, io, xyz..." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
              </Field>
              <p className="text-[11px] text-muted-foreground">Lưu cấu hình trước, sau đó bấm <b>Đồng bộ giá</b>. Chỉ tạo/cập nhật đuôi provider Spaceship, không đụng đuôi đơn tay.</p>
            </div>
          </div>
        )}
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <button onClick={() => testMut.mutate()} disabled={isPending || !data} className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">Test</button>
          <button onClick={() => syncMut.mutate()} disabled={isPending || !data} className="rounded-md border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-600 hover:bg-sky-500/20 disabled:opacity-50">{syncMut.isPending ? "Đang đồng bộ..." : "Đồng bộ giá"}</button>
          <button onClick={onClose} disabled={isPending} className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">Hủy</button>
          <button onClick={handleSave} disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">Lưu</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
