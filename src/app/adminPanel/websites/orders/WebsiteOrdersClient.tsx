"use client"

import { useBulkSelect } from "@/hooks/use-bulk-select"
import { BulkActionBar, BulkSelectHead, BulkSelectCell } from "@/components/admin/bulk-action-bar"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { IconMonitor } from "@/components/icons"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTRPC } from "@/trpc/client"
import { toast } from "@/components/ui/toast"

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "pending", label: "Chờ worker" },
  { value: "active", label: "Đang chạy" },
  { value: "expired", label: "Hết hạn" },
  { value: "suspended", label: "Tạm khóa" },
  { value: "error_refund", label: "Lỗi/hoàn tiền" },
]

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value || 0) + "đ"
}

function formatDateTime(input: unknown): string {
  if (!input) return "-"
  const date = new Date(String(input))
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("vi-VN")
}

export function AdminWebsiteOrdersClient() {
  const trpc = useTRPC()
  const [searchInput, setSearchInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  useEffect(() => {
    const timer = setTimeout(() => { setKeyword(searchInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminWebsite.listOrders.queryOptions({ page, limit, keyword: keyword || undefined, status: (status || undefined) as never })
  ) as { data: { items: Array<Record<string, any>>; total: number; totalPages: number } | undefined; isLoading: boolean; isFetching: boolean }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)
  const bulk = useBulkSelect(items as any[])
  const bulkDeleteMut = useMutation({
    ...trpc.adminWebsite.bulkDeleteOrders.mutationOptions(),
    onSuccess: (result) => { toast.success(`Đã xóa ${result.deleted} đơn website`); bulk.clearAll() },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><IconMonitor size={20} /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Đơn website</h1>
          <p className="text-sm text-muted-foreground">Danh sách đơn thuê website. User tạo đơn xong worker sẽ tự deploy qua aaPanel.</p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm domain, mẫu, username..." className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          {isFetching && !isLoading && <span className="absolute right-3 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}
        </div>
        <SelectCustom value={status} onValueChange={(value) => { setStatus(value); setPage(1) }} options={STATUS_OPTIONS} />
      </div>

      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader><TableRow><BulkSelectHead checked={bulk.isAllSelected} onChange={bulk.toggleAll} /><TableHead className="w-[60px]">#</TableHead><TableHead>Khách</TableHead><TableHead>Domain</TableHead><TableHead>Mẫu</TableHead><TableHead className="text-right">Tổng</TableHead><TableHead>Trạng thái</TableHead><TableHead>Server</TableHead><TableHead>Tạo lúc</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>{Array.from({ length: 9 }).map((__, cellIndex) => <TableCell key={cellIndex}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>
            )) : items.length > 0 ? items.map((order, index) => (
              <TableRow key={order.id}>
                <BulkSelectCell checked={bulk.isSelected(order.id)} onChange={() => bulk.toggle(order.id)} />
                <TableCell><span className="font-mono text-sm text-muted-foreground">{startRow + index}</span></TableCell>
                <TableCell className="font-semibold">{order.username}</TableCell>
                <TableCell className="font-medium">{order.domainName}</TableCell>
                <TableCell>{order.serviceName}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatMoney(order.total)}</TableCell>
                <TableCell><StatusBadge status={String(order.status)} /></TableCell>
                <TableCell>{order.provision?.serverName ?? "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Chưa có đơn website.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {items.map((order) => (
          <div key={order.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{order.domainName}</p>
                <p className="text-sm text-muted-foreground">{order.serviceName}</p>
              </div>
              <StatusBadge status={String(order.status)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Info label="Khách" value={String(order.username)} />
              <Info label="Tổng" value={formatMoney(Number(order.total))} />
              <Info label="Server" value={order.provision?.serverName ?? "-"} />
              <Info label="Tạo lúc" value={formatDateTime(order.createdAt)} />
            </div>
          </div>
        ))}
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} đơn</div>
          <div className="flex items-center gap-4">
            <SelectCustom value={String(limit)} onValueChange={(value) => { setLimit(Number(value)); setPage(1) }} size="sm" className="w-[80px]" options={[{ value: "10", label: "10" }, { value: "20", label: "20" }, { value: "50", label: "50" }]} />
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1} className="h-8 rounded-md border bg-background px-3 text-sm font-medium disabled:opacity-50">Trước</button>
              <span className="px-2 text-sm text-muted-foreground">{page} / {totalPages}</span>
              <button onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages} className="h-8 rounded-md border bg-background px-3 text-sm font-medium disabled:opacity-50">Sau</button>
            </div>
          </div>
        </div>
      )}
      <BulkActionBar selectedCount={bulk.selectedCount} onClearAll={bulk.clearAll} onBulkDelete={() => bulkDeleteMut.mutate({ ids: bulk.getSelectedIds() })} isPending={bulkDeleteMut.isPending} entityLabel="đơn website" />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    pending: "Chờ worker",
    active: "Đang chạy",
    expired: "Hết hạn",
    cancelled: "Đã hủy",
    cancelled_refund: "Đã hoàn tiền",
    error_refund: "Lỗi/hoàn tiền",
    suspended: "Tạm khóa",
  }
  return <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-semibold">{labelMap[status] ?? status}</span>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="truncate font-medium">{value}</p></div>
}
