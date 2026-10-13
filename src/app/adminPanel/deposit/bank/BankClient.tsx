"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { IconCircleCheck, IconCreditCard } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"

interface AdminInvoice {
  id: string
  stt: number
  transId: string
  gateway: string
  gatewayName: string
  username: string
  bankAccount: string
  bankAccountName: string
  amount: number
  finalAmount: number
  status: 0 | 1 | 2
  createdAt: string | Date
  paidAt: string | Date | null
}

const statusOptions = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "0", label: "Chờ thanh toán" },
  { value: "1", label: "Đã thanh toán" },
  { value: "2", label: "Đã hủy / hết hạn" },
]

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value)
  return `${new Intl.NumberFormat("vi-VN").format(Number.isFinite(amount) ? amount : 0)}đ`
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getStatusBadge(status: AdminInvoice["status"]) {
  if (status === 1) {
    return "bg-emerald-500/15 text-emerald-600"
  }
  if (status === 2) {
    return "bg-rose-500/15 text-rose-600"
  }
  return "bg-amber-500/15 text-amber-600"
}

function getStatusText(status: AdminInvoice["status"]): string {
  if (status === 1) return "Đã thanh toán"
  if (status === 2) return "Đã hủy"
  return "Chờ xử lý"
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
export function BankClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [confirmInvoice, setConfirmInvoice] = useState<{
    invoice: AdminInvoice
    status: 1 | 2
  } | null>(null)

  const { data: invoices = [], isLoading, isFetching } = useQuery(
    trpc.adminDeposit.getAdminInvoices.queryOptions({ limit: 500 })
  ) as { data: AdminInvoice[]; isLoading: boolean; isFetching: boolean }

  const updateStatusMutation = useMutation({
    ...trpc.adminDeposit.updateInvoiceStatus.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.paid ? "Đã duyệt hóa đơn" : "Đã từ chối hóa đơn")
      setConfirmInvoice(null)
      queryClient.invalidateQueries({ queryKey: trpc.adminDeposit.getAdminInvoices.queryKey() })
    },
    onError: (error) => toast.error(error.message || "Cập nhật hóa đơn thất bại"),
  })

  const filteredInvoices = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const matchesStatus = statusFilter === "all" || String(invoice.status) === statusFilter
      const matchesKeyword = !keyword || [
        invoice.transId,
        invoice.gateway,
        invoice.gatewayName,
        invoice.username,
        invoice.bankAccount,
        invoice.bankAccountName,
      ].some((value) => String(value || "").toLowerCase().includes(keyword))
      return matchesStatus && matchesKeyword
    })
  }, [invoices, search, statusFilter])
  function handleConfirm(): void {
    if (!confirmInvoice) return
    updateStatusMutation.mutate({
      id: confirmInvoice.invoice.id,
      status: confirmInvoice.status,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">Admin</Link>
            <ChevronRight />
            <span>Tài chính</span>
            <ChevronRight />
            <span className="text-foreground">Ngân hàng</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
              <IconCreditCard size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Nạp ngân hàng</h1>
              <p className="text-sm text-muted-foreground">
                Theo dõi hóa đơn, duyệt thủ công và kiểm tra trạng thái nạp tự động.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/adminPanel/deposit/bank/config">Cấu hình</Link>
          </Button>
          <Button asChild>
            <Link href="/adminPanel/deposit/bank/config">DS Ngân hàng</Link>
          </Button>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Hệ thống hiện đang hỗ trợ tích hợp và xử lý giao dịch ngân hàng tự động. Quản lý danh sách ngân hàng và theo dõi hoá đơn nạp tiền tại đây. Đồng thời, đối với ACB và MBBANK, hệ thống sử dụng hạ tầng do chính chúng tôi trực tiếp vận hành nhằm đảm bảo tốc độ và độ ổn định. Với các ngân hàng như VPBank, Techcombank, MSB, BIDV, VietinBank, TPBank và nhiều ngân hàng khác, việc kết nối và quản lý giao dịch được thực hiện thông qua các đối tác kỹ thuật API.CODERENT.VN hoặc THUEAPIBANK.VN


        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <SearchIcon />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm mã hóa đơn, ngân hàng, người dùng..."
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {isFetching && !isLoading && (
            <span className="absolute right-3 top-1/2 inline-block size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          )}
        </div>
        <SelectCustom
          value={statusFilter}
          onValueChange={setStatusFilter}
          className="w-full sm:w-[200px]"
          options={statusOptions}
        />
      </div>
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Mã giao dịch</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Ngân hàng</TableHead>
              <TableHead className="text-right">Tiền nạp</TableHead>
              <TableHead className="text-right">Thực nhận</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: 9 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((invoice, index) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <div className="font-mono text-xs font-semibold">{invoice.transId}</div>
                    <div className="text-[11px] text-muted-foreground">{invoice.gateway}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{invoice.username}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{invoice.gatewayName}</div>
                    <div className="text-xs text-muted-foreground">{invoice.bankAccount || "-"}</div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatMoney(invoice.amount)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 tabular-nums">{formatMoney(invoice.finalAmount)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getStatusBadge(invoice.status)}`}>
                      {getStatusText(invoice.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{formatDateTime(invoice.createdAt)}</div>
                    {invoice.paidAt && <div className="text-[11px] text-emerald-600">Paid {formatDateTime(invoice.paidAt)}</div>}
                  </TableCell>
                  <TableCell className="text-end">
                    {invoice.status === 0 ? (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => setConfirmInvoice({ invoice, status: 1 })}>Duyệt</Button>
                        <Button size="sm" variant="destructive" onClick={() => setConfirmInvoice({ invoice, status: 2 })}>Từ chối</Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Đã xử lý</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Không có hóa đơn phù hợp.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 w-full" />)
        ) : filteredInvoices.length > 0 ? (
          filteredInvoices.map((invoice) => (
            <div key={invoice.id} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold">{invoice.transId}</p>
                  <p className="text-xs text-muted-foreground">{invoice.username} · {invoice.gateway}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${getStatusBadge(invoice.status)}`}>
                  {getStatusText(invoice.status)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Tiền nạp</p>
                  <p className="font-semibold tabular-nums">{formatMoney(invoice.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Thực nhận</p>
                  <p className="font-bold text-emerald-600 tabular-nums">{formatMoney(invoice.finalAmount)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Ngân hàng</p>
                  <p className="font-medium">{invoice.gatewayName} · {invoice.bankAccount || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Tạo lúc</p>
                  <p>{formatDateTime(invoice.createdAt)}</p>
                </div>
              </div>
              {invoice.status === 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-emerald-600" onClick={() => setConfirmInvoice({ invoice, status: 1 })}>Duyệt</Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => setConfirmInvoice({ invoice, status: 2 })}>Từ chối</Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Không có hóa đơn phù hợp.</div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmInvoice}
        onOpenChange={(open) => !open && setConfirmInvoice(null)}
        title={confirmInvoice?.status === 1 ? "Xác nhận duyệt hóa đơn" : "Xác nhận từ chối hóa đơn"}
        description={
          confirmInvoice?.status === 1
            ? "Hệ thống sẽ đánh dấu đã thanh toán và cộng tiền vào tài khoản khách."
            : "Hóa đơn pending sẽ được chuyển sang trạng thái đã hủy."
        }
        variant={confirmInvoice?.status === 2 ? "destructive" : "default"}
        icon={confirmInvoice?.status === 1 ? <IconCircleCheck size={20} className="text-emerald-600" /> : undefined}
        confirmText={confirmInvoice?.status === 1 ? "Duyệt hóa đơn" : "Từ chối"}
        cancelText="Hủy"
        isPending={updateStatusMutation.isPending}
        onConfirm={handleConfirm}
      >
        {confirmInvoice && (
          <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Mã giao dịch</span>
              <span className="font-mono font-semibold text-foreground">{confirmInvoice.invoice.transId}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Khách hàng</span>
              <span className="font-medium text-foreground">{confirmInvoice.invoice.username}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Số tiền cộng</span>
              <span className="font-bold text-emerald-600 tabular-nums">{formatMoney(confirmInvoice.invoice.finalAmount)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
