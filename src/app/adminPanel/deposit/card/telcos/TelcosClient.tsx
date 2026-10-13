"use client"

import { useBulkSelect } from "@/hooks/use-bulk-select"
import { BulkActionBar, BulkSelectHead, BulkSelectCell } from "@/components/admin/bulk-action-bar"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { IconCreditCard } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"

interface TelcoItem {
  id: string
  telco: string
  img: string
  value: number
  fees: number
  penalty: number
}

interface TelcoFormState {
  telco: string
  img: string
  value: number
  fees: number
  penalty: number
}

const emptyForm: TelcoFormState = {
  telco: "",
  img: "",
  value: 0,
  fees: 0,
  penalty: 0,
}

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value)
  return `${new Intl.NumberFormat("vi-VN").format(Number.isFinite(amount) ? amount : 0)}đ`
}

function ChevronRight() {
  return <span className="text-muted-foreground/50">/</span>
}

function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
export function TelcosClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TelcoItem | null>(null)
  const [deleting, setDeleting] = useState<TelcoItem | null>(null)

  const { data: telcos = [], isLoading, isFetching } = useQuery(
    trpc.adminDeposit.getAdminTelcos.queryOptions()
  ) as { data: TelcoItem[]; isLoading: boolean; isFetching: boolean }

  const filteredTelcos = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return telcos
    return telcos.filter((item) =>
      [item.telco, item.value, item.fees, item.penalty].some((value) =>
        String(value || "").toLowerCase().includes(keyword)
      )
    )
  }, [telcos, search])

  const summary = useMemo(() => {
    const map = new Map<string, { count: number; img: string }>()
    for (const item of telcos) {
      const current = map.get(item.telco) || { count: 0, img: item.img }
      current.count += 1
      if (item.img) current.img = item.img
      map.set(item.telco, current)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [telcos])

  const invalidateTelcos = () => {
    queryClient.invalidateQueries({ queryKey: trpc.adminDeposit.getAdminTelcos.queryKey() })
  }

  const createMutation = useMutation({
    ...trpc.adminDeposit.addAdminTelco.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã thêm mệnh giá")
      setCreating(false)
      invalidateTelcos()
    },
    onError: (error) => toast.error(error.message || "Thêm thất bại"),
  })

  const updateMutation = useMutation({
    ...trpc.adminDeposit.updateAdminTelco.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã cập nhật mệnh giá")
      setEditing(null)
      invalidateTelcos()
    },
    onError: (error) => toast.error(error.message || "Cập nhật thất bại"),
  })
  const deleteMutation = useMutation({
    ...trpc.adminDeposit.deleteAdminTelco.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã xóa mệnh giá")
      setDeleting(null)
      invalidateTelcos()
    },
    onError: (error) => toast.error(error.message || "Xóa thất bại"),
  })

  const syncMutation = useMutation({
    ...trpc.adminDeposit.syncTelcosFromApi.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Đồng bộ xong: thêm ${result.inserted}, cập nhật ${result.updated}`)
      invalidateTelcos()
    },
    onError: (error) => toast.error(error.message || "Đồng bộ thất bại"),
  })
  const bulk = useBulkSelect(filteredTelcos)
  const bulkDeleteMut = useMutation({
    ...trpc.adminDeposit.bulkDeleteAdminTelcos.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} mệnh giá`); bulk.clearAll(); invalidateTelcos() },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">Admin</Link>
            <ChevronRight />
            <Link href="/adminPanel/deposit/card" className="transition-colors hover:text-foreground">Thẻ cào</Link>
            <ChevronRight />
            <span className="text-foreground">Nhà mạng</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600">
              <IconCreditCard size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Nhà mạng & mệnh giá</h1>
              <p className="text-sm text-muted-foreground">Quản lý phí API, phạt sai mệnh giá và logo nhà mạng.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/adminPanel/deposit/card">Quay lại</Link></Button>
          <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>{syncMutation.isPending ? "Đang đồng bộ..." : "Đồng bộ API"}</Button>
          <Button onClick={() => setCreating(true)}>Thêm mệnh giá</Button>
        </div>
      </div>

      {summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.map(([name, item]) => (
            <div key={name} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              {item.img ? <img src={item.img} alt={name} className="size-5 rounded object-contain" /> : <IconCreditCard size={16} />}
              <span className="text-sm font-bold uppercase">{name}</span>
              <span className="text-xs text-muted-foreground">({item.count} MG)</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <SearchIcon />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm nhà mạng, mệnh giá..."
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {isFetching && !isLoading && <span className="absolute right-3 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}
        </div>
        <Button variant="outline" onClick={() => setSearch("")}>Xóa lọc</Button>
      </div>

      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <BulkSelectHead checked={bulk.isAllSelected} onChange={bulk.toggleAll} />
              <TableHead>Nhà mạng</TableHead>
              <TableHead className="text-right">Mệnh giá</TableHead>
              <TableHead className="text-center">Chiết khấu API</TableHead>
              <TableHead className="text-center">Phạt sai MG</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>{Array.from({ length: 6 }).map((__, cellIndex) => <TableCell key={cellIndex}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>
              ))
            ) : filteredTelcos.length > 0 ? (
              filteredTelcos.map((item) => (
                <TableRow key={item.id}>
                  <BulkSelectCell checked={bulk.isSelected(item.id)} onChange={() => bulk.toggle(item.id)} />
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.img ? <img src={item.img} alt={item.telco} className="size-7 rounded object-contain" /> : <IconCreditCard size={18} />}
                      <span className="text-sm font-bold uppercase">{item.telco}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatMoney(item.value)}</TableCell>
                  <TableCell className="text-center text-sm font-medium text-rose-600">{item.fees}%</TableCell>
                  <TableCell className="text-center text-sm font-medium text-amber-600">{item.penalty}%</TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setEditing(item)}>Sửa</Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleting(item)}>Xóa</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Chưa có mệnh giá nào.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        {filteredTelcos.map((item) => (
          <div key={item.id} className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {item.img ? <img src={item.img} alt={item.telco} className="size-8 rounded object-contain" /> : <IconCreditCard size={18} />}
                <span className="font-bold uppercase">{item.telco}</span>
              </div>
              <span className="font-semibold tabular-nums">{formatMoney(item.value)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-muted-foreground">API fee</p><p className="font-semibold text-rose-600">{item.fees}%</p></div>
              <div><p className="text-muted-foreground">Phạt sai MG</p><p className="font-semibold text-amber-600">{item.penalty}%</p></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(item)}>Sửa</Button>
              <Button size="sm" variant="destructive" className="flex-1" onClick={() => setDeleting(item)}>Xóa</Button>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <TelcoFormDialog
          item={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          isPending={createMutation.isPending || updateMutation.isPending}
          onSubmit={(form) => {
            if (editing) updateMutation.mutate({ id: editing.id, ...form })
            else createMutation.mutate(form)
          }}
        />
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClearAll={bulk.clearAll}
        onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })}
        isPending={bulkDeleteMut.isPending}
        entityLabel="mệnh giá"
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa mệnh giá"
        description={deleting ? `Xóa ${deleting.telco} - ${formatMoney(deleting.value)}?` : ""}
        variant="destructive"
        confirmText="Xóa"
        cancelText="Hủy"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate({ id: deleting.id })}
      />
    </div>
  )
}
function TelcoFormDialog({ item, onClose, onSubmit, isPending }: { item: TelcoItem | null; onClose: () => void; onSubmit: (form: TelcoFormState) => void; isPending: boolean }) {
  const [form, setForm] = useState<TelcoFormState>(() => item ? {
    telco: item.telco,
    img: item.img,
    value: item.value,
    fees: item.fees,
    penalty: item.penalty,
  } : emptyForm)

  function setField<K extends keyof TelcoFormState>(key: K, value: TelcoFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(): void {
    const payload = {
      telco: form.telco.trim().toUpperCase(),
      img: form.img.trim(),
      value: Number(form.value) || 0,
      fees: Number(form.fees) || 0,
      penalty: Number(form.penalty) || 0,
    }
    if (!payload.telco || payload.value <= 0) {
      toast.error("Vui lòng nhập nhà mạng và mệnh giá")
      return
    }
    onSubmit(payload)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader><DialogTitle>{item ? "Sửa mệnh giá" : "Thêm mệnh giá"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Nhà mạng"><Input value={form.telco} onChange={(event) => setField("telco", event.target.value)} placeholder="VIETTEL, MOBIFONE..." /></Field>
          <Field label="Logo URL"><Input value={form.img} onChange={(event) => setField("img", event.target.value)} placeholder="/telco/viettel.svg hoặc URL" /></Field>
          <Field label="Mệnh giá"><Input type="number" value={form.value} onChange={(event) => setField("value", Number(event.target.value))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Chiết khấu API (%)"><Input type="number" value={form.fees} onChange={(event) => setField("fees", Number(event.target.value))} /></Field>
            <Field label="Phạt sai MG (%)"><Input type="number" value={form.penalty} onChange={(event) => setField("penalty", Number(event.target.value))} /></Field>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={isPending}>{isPending ? "Đang lưu..." : item ? "Cập nhật" : "Thêm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
