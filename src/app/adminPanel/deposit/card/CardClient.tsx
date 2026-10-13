"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { IconCreditCard } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectCustom } from "@/components/ui/select-custom"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { useTRPC } from "@/trpc/client"

interface CardItem {
  id: string
  stt: number
  transId: string
  telco: string
  serial: string
  pin: string
  amount: number
  price: number
  status: "pending" | "completed" | "error" | string
  reason: string
  username: string
  createdAt: string | Date
}

interface CardConfig {
  cardStatus: boolean
  partnerId: string
  partnerKey: string
  cardCk: number
  urlApi: string
  cardNotice?: string
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "Đang xử lý", color: "bg-amber-500/15 text-amber-600" },
  completed: { label: "Thành công", color: "bg-emerald-500/15 text-emerald-600" },
  error: { label: "Thất bại", color: "bg-rose-500/15 text-rose-600" },
}

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "pending", label: "Đang xử lý" },
  { value: "completed", label: "Thành công" },
  { value: "error", label: "Thất bại" },
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

export function CardClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [configOpen, setConfigOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [limit, setLimit] = useState(20)
  const [configForm, setConfigForm] = useState<CardConfig | null>(null)

  const { data: cards = [], isLoading, isFetching } = useQuery(
    trpc.adminDeposit.getAdminCards.queryOptions({ limit: 500 })
  ) as { data: CardItem[]; isLoading: boolean; isFetching: boolean }
  const { data: config } = useQuery(
    trpc.adminDeposit.getAdminCardConfig.queryOptions()
  ) as { data: CardConfig | undefined }

  useEffect(() => {
    if (config) setConfigForm(config)
  }, [config])

  const updateConfigMutation = useMutation({
    ...trpc.adminDeposit.updateAdminCardConfig.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình thẻ")
      setConfigOpen(false)
      queryClient.invalidateQueries({ queryKey: trpc.adminDeposit.getAdminCardConfig.queryKey() })
    },
    onError: (error) => toast.error(error.message || "Lưu cấu hình thất bại"),
  })
  const filteredCards = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return cards.filter((card) => {
      const matchesStatus = !statusFilter || card.status === statusFilter
      const matchesKeyword = !keyword || [card.serial, card.telco, card.transId, card.username, card.reason]
        .some((value) => String(value || "").toLowerCase().includes(keyword))
      return matchesStatus && matchesKeyword
    })
  }, [cards, search, statusFilter])

  const items = filteredCards.slice(0, limit)

  function updateConfigField<K extends keyof CardConfig>(key: K, value: CardConfig[K]): void {
    setConfigForm((current) => current ? { ...current, [key]: value } : current)
  }

  function handleSaveConfig(): void {
    if (!configForm) return
    updateConfigMutation.mutate({
      cardStatus: configForm.cardStatus,
      partnerId: configForm.partnerId.trim(),
      partnerKey: configForm.partnerKey.trim(),
      cardCk: Number(configForm.cardCk) || 0,
      urlApi: configForm.urlApi.trim(),
      cardNotice: configForm.cardNotice ?? "",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <a href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">Admin</a>
            <ChevronRight />
            <span>Tài chính</span>
            <ChevronRight />
            <span className="text-foreground">Thẻ cào</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600">
              <IconCreditCard size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Nạp thẻ cào</h1>
              <p className="text-sm text-muted-foreground">Quản lý lịch sử nạp thẻ, cấu hình partner và callback.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/adminPanel/deposit/card/telcos">DS Nhà mạng</Link></Button>
          <Button variant="outline" onClick={() => setConfigOpen(true)}>Cấu hình</Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <SearchIcon />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm serial, mã GD, nhà mạng, user..."
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {isFetching && !isLoading && <span className="absolute right-3 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />}
        </div>
        <SelectCustom value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-[180px]" options={statusOptions} />
        <SelectCustom value={String(limit)} onValueChange={(value) => setLimit(Number(value))} className="w-full sm:w-[100px]" options={[{ value: "20", label: "20 dòng" }, { value: "50", label: "50 dòng" }, { value: "100", label: "100 dòng" }]} />
        <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("") }}>Xóa lọc</Button>
      </div>
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Nhà mạng</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Mã GD</TableHead>
              <TableHead className="text-right">Mệnh giá</TableHead>
              <TableHead className="text-right">Thực nhận</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Thời gian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>{Array.from({ length: 9 }).map((__, cellIndex) => <TableCell key={cellIndex}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((card, index) => {
                const status = statusMap[card.status] ?? { label: card.status, color: "bg-muted text-muted-foreground" }
                return (
                  <TableRow key={card.id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="text-sm font-semibold">{card.username}</TableCell>
                    <TableCell className="text-sm font-bold uppercase">{card.telco}</TableCell>
                    <TableCell className="font-mono text-xs">{card.serial}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{card.transId}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatMoney(card.amount)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 tabular-nums">{card.price > 0 ? formatMoney(card.price) : "-"}</TableCell>
                    <TableCell><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${status.color}`}>{status.label}</span></TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(card.createdAt)}</span>
                      {card.reason && <p className="max-w-[180px] truncate text-[11px] text-rose-600" title={card.reason}>{card.reason}</p>}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Không có lịch sử thẻ.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {items.map((card) => {
          const status = statusMap[card.status] ?? { label: card.status, color: "bg-muted text-muted-foreground" }
          return (
            <div key={card.id} className="space-y-2 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{card.username}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.color}`}>{status.label}</span>
              </div>
              <p className="text-sm font-bold uppercase">{card.telco} · {formatMoney(card.amount)}</p>
              <p className="font-mono text-xs text-muted-foreground">Serial: {card.serial}</p>
              <p className="text-sm font-bold text-emerald-600">Thực nhận: {card.price > 0 ? formatMoney(card.price) : "-"}</p>
            </div>
          )
        })}
      </div>
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
          <DialogHeader><DialogTitle>Cấu hình nạp thẻ cào</DialogTitle></DialogHeader>
          {configForm ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <Label>Trạng thái nạp thẻ</Label>
                  <p className="text-xs text-muted-foreground">Bật/tắt cổng nạp thẻ ở phía khách hàng.</p>
                </div>
                <button type="button" onClick={() => updateConfigField("cardStatus", !configForm.cardStatus)} className={`relative h-6 w-11 rounded-full transition-colors ${configForm.cardStatus ? "bg-emerald-500" : "bg-muted"}`} aria-label="Bật tắt nạp thẻ">
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${configForm.cardStatus ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
              <Field label="Partner ID"><Input value={configForm.partnerId} onChange={(event) => updateConfigField("partnerId", event.target.value)} /></Field>
              <Field label="Partner Key"><Input value={configForm.partnerKey} onChange={(event) => updateConfigField("partnerKey", event.target.value)} /></Field>
              <Field label="Phí nạp thẻ (%)"><Input type="number" value={configForm.cardCk} onChange={(event) => updateConfigField("cardCk", Number(event.target.value))} /></Field>
              <Field label="URL API CARD"><Input value={configForm.urlApi} onChange={(event) => updateConfigField("urlApi", event.target.value)} placeholder="https://doithe1s.vn/chargingws/v2" /></Field>
              <Field label="URL CALLBACK CARD">
                <Input value={typeof window !== "undefined" ? `${window.location.origin}/api/card/callback` : "/api/card/callback"} readOnly />
                <p className="mt-1 text-xs text-muted-foreground">Dán URL này vào hệ thống partner thẻ cào.</p>
              </Field>
            </div>
          ) : <Skeleton className="h-64 w-full" />}
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setConfigOpen(false)} disabled={updateConfigMutation.isPending}>Hủy</Button>
            <Button onClick={handleSaveConfig} disabled={!configForm || updateConfigMutation.isPending}>{updateConfigMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
