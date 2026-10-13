"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { IconShield } from "@/components/icons"
import { cn } from "@/lib/utils"

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDateTime(input: any) {
  if (!input) return "—"
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function timeUntil(input: any): string {
  if (!input) return "Vĩnh viễn"
  const t = new Date(input).getTime()
  if (!Number.isFinite(t)) return "—"
  const diff = t - Date.now()
  if (diff <= 0) return "Đã hết"
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} phút`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} giờ`
  const day = Math.floor(hr / 24)
  return `${day} ngày`
}

const SOURCE_LABEL: Record<string, { label: string; cls: string }> = {
  manual: { label: "Admin", cls: "bg-purple-500/15 text-purple-600" },
  auto: { label: "Tự động", cls: "bg-amber-500/15 text-amber-600" },
  callback: { label: "Callback", cls: "bg-rose-500/15 text-rose-600" },
}

// ─── Inline icons ──────────────────────────────────────────────────────────
const Ic = {
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.34-4.34"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  ban: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>,
  bot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/></svg>,
  lock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  infinity: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.739-8z"/></svg>,
}

// ═══ MAIN ══════════════════════════════════════════════════════════════════
export function AdminIpBlockClient() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [page, setPage] = React.useState(1)
  const [limit, setLimit] = React.useState(20)
  const [keyword, setKeyword] = React.useState("")
  const [searchInput, setSearchInput] = React.useState("")
  const [sourceFilter, setSourceFilter] = React.useState<string>("all")
  const [addOpen, setAddOpen] = React.useState(false)
  const [removing, setRemoving] = React.useState<{ ip: string } | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isFetching } = useQuery(
    trpc.adminIpBlock.list.queryOptions({
      page,
      limit,
      keyword: keyword || undefined,
      source: sourceFilter !== "all" ? (sourceFilter as any) : undefined,
    })
  ) as { data: any; isLoading: boolean; isFetching: boolean }

  const items: any[] = data?.items ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1
  const stats = data?.stats ?? { total: 0, manual: 0, auto: 0, callback: 0, permanent: 0 }
  const startRow = (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  const removeMut = useMutation({
    ...trpc.adminIpBlock.remove.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã bỏ chặn IP")
      setRemoving(null)
      qc.invalidateQueries({ queryKey: trpc.adminIpBlock.list.queryKey() })
    },
    onError: (err: any) => toast.error(err?.message || "Bỏ chặn thất bại"),
  })

  const removeBulkMut = useMutation({
    ...trpc.adminIpBlock.removeBulk.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(`Đã bỏ chặn ${res.deleted} IP`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: trpc.adminIpBlock.list.queryKey() })
    },
    onError: (err: any) => toast.error(err?.message || "Bỏ chặn thất bại"),
  })

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.ip))
  const someSelected = items.some((i) => selected.has(i.ip))

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected)
      items.forEach((i) => next.delete(i.ip))
      setSelected(next)
    } else {
      const next = new Set(selected)
      items.forEach((i) => next.add(i.ip))
      setSelected(next)
    }
  }
  function toggleOne(ip: string) {
    const next = new Set(selected)
    if (next.has(ip)) next.delete(ip)
    else next.add(ip)
    setSelected(next)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + title */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">Admin</a>
          <ChevronRight />
          <span>Hệ thống</span>
          <ChevronRight />
          <span className="font-normal text-foreground">Chặn truy cập</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600">
            <IconShield size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chặn truy cập</h1>
            <p className="text-sm text-muted-foreground">
              Danh sách IP bị chặn — admin thêm thủ công, hoặc tự động khi vượt rate-limit / sai callback secret.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Tổng IP" value={stats.total} icon={Ic.ban} color="text-rose-600" bg="bg-rose-500/10" />
        <StatCard label="Admin chặn" value={stats.manual} icon={<IconShield size={18} />} color="text-purple-600" bg="bg-purple-500/10" />
        <StatCard label="Tự động" value={stats.auto} icon={Ic.bot} color="text-amber-600" bg="bg-amber-500/10" />
        <StatCard label="Sai callback" value={stats.callback} icon={Ic.lock} color="text-pink-600" bg="bg-pink-500/10" />
        <StatCard label="Vĩnh viễn" value={stats.permanent} icon={Ic.infinity} color="text-indigo-600" bg="bg-indigo-500/10" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          {Ic.search}
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo IP hoặc lý do..."
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          {isFetching && !isLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          )}
        </div>
        <SelectCustom
          value={sourceFilter}
          onValueChange={(v) => { setSourceFilter(v); setPage(1) }}
          className="w-full sm:w-[180px]"
          options={[
            { value: "all", label: "Tất cả nguồn" },
            { value: "manual", label: "Admin chặn" },
            { value: "auto", label: "Tự động" },
            { value: "callback", label: "Sai callback" },
          ]}
        />
        <div className="flex gap-2 sm:ml-auto">
          {someSelected && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => removeBulkMut.mutate({ ips: Array.from(selected) })}
              disabled={removeBulkMut.isPending}
              className="gap-1.5"
            >
              {Ic.trash} Bỏ chặn ({selected.size})
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            {Ic.plus} Thêm IP
          </Button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4 cursor-pointer rounded border-input"
                />
              </TableHead>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Lý do</TableHead>
              <TableHead>Nguồn</TableHead>
              <TableHead className="text-right">Hits</TableHead>
              <TableHead>Hết hạn</TableHead>
              <TableHead>Tạo lúc</TableHead>
              <TableHead className="text-end">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((b: any, i: number) => {
                const src = SOURCE_LABEL[b.source] || SOURCE_LABEL.manual
                const expired = b.expiresAt && new Date(b.expiresAt).getTime() <= Date.now()
                return (
                  <TableRow key={b.id} className={selected.has(b.ip) ? "bg-muted/30" : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(b.ip)}
                        onChange={() => toggleOne(b.ip)}
                        className="size-4 cursor-pointer rounded border-input"
                      />
                    </TableCell>
                    <TableCell><span className="font-mono text-sm text-muted-foreground">{startRow + i}</span></TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{b.ip}</code>
                    </TableCell>
                    <TableCell>
                      {b.reason ? (
                        <span className="line-clamp-2 max-w-[280px] text-sm" title={b.reason}>{b.reason}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">— Không ghi chú —</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", src.cls)}>
                        {src.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-sm">{b.hits}</TableCell>
                    <TableCell>
                      {b.expiresAt ? (
                        <span className={cn("text-xs", expired ? "text-muted-foreground line-through" : "text-foreground")} title={formatDateTime(b.expiresAt)}>
                          {timeUntil(b.expiresAt)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                          ∞ Vĩnh viễn
                        </span>
                      )}
                    </TableCell>
                    <TableCell><span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(b.createdAt)}</span></TableCell>
                    <TableCell className="text-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                        onClick={() => setRemoving({ ip: b.ip })}
                      >
                        Bỏ chặn
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Không có IP nào bị chặn.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border bg-card p-4">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))
        ) : items.length > 0 ? (
          items.map((b: any) => {
            const src = SOURCE_LABEL[b.source] || SOURCE_LABEL.manual
            return (
              <div key={b.id} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <code className="block truncate rounded bg-muted px-2 py-0.5 font-mono text-xs">{b.ip}</code>
                    {b.reason && <p className="mt-2 text-sm text-foreground">{b.reason}</p>}
                  </div>
                  <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", src.cls)}>
                    {src.label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Hits: <b className="text-foreground tabular-nums">{b.hits}</b></span>
                  <span>{b.expiresAt ? timeUntil(b.expiresAt) : "Vĩnh viễn"}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-rose-600"
                  onClick={() => setRemoving({ ip: b.ip })}
                >
                  Bỏ chặn
                </Button>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
            Không có IP nào bị chặn.
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">Hiển thị {startRow}-{endRow} / {total} IP</div>
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
                  { value: "100", label: "100" },
                ]}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trước</Button>
              <span className="px-2 text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sau</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add dialog */}
      {addOpen && <AddIpDialog onClose={() => setAddOpen(false)} />}

      {/* Remove confirm */}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Bỏ chặn IP"
        description={`Bỏ chặn ${removing?.ip ?? ""}? IP này sẽ truy cập website bình thường trở lại.`}
        variant="destructive"
        confirmText="Bỏ chặn"
        cancelText="Hủy"
        isPending={removeMut.isPending}
        onConfirm={() => removing && removeMut.mutate({ ip: removing.ip })}
      />
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  color,
  bg,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  bg: string
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", bg, color)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="max-w-full truncate text-lg font-bold tabular-nums leading-tight text-foreground">
            {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Add Dialog ────────────────────────────────────────────────────────────
function AddIpDialog({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const [ip, setIp] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [ttlMode, setTtlMode] = React.useState<string>("permanent")

  const TTL_PRESETS: Record<string, { label: string; ms: number | null }> = {
    permanent: { label: "Vĩnh viễn", ms: null },
    "15m": { label: "15 phút", ms: 15 * 60 * 1000 },
    "1h": { label: "1 giờ", ms: 60 * 60 * 1000 },
    "24h": { label: "1 ngày", ms: 24 * 60 * 60 * 1000 },
    "7d": { label: "7 ngày", ms: 7 * 24 * 60 * 60 * 1000 },
    "30d": { label: "30 ngày", ms: 30 * 24 * 60 * 60 * 1000 },
  }

  const mut = useMutation({
    ...trpc.adminIpBlock.add.mutationOptions(),
    onSuccess: () => {
      toast.success(`Đã chặn ${ip}`)
      qc.invalidateQueries({ queryKey: trpc.adminIpBlock.list.queryKey() })
      onClose()
    },
    onError: (err: any) => toast.error(err?.message || "Thêm thất bại"),
  })

  function handleSubmit() {
    if (!ip.trim()) return toast.error("Vui lòng nhập IP")
    mut.mutate({
      ip: ip.trim(),
      reason: reason.trim() || undefined,
      source: "manual",
      ttlMs: TTL_PRESETS[ttlMode].ms,
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !mut.isPending && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chặn IP truy cập</DialogTitle>
          <DialogDescription>
            IP sẽ bị chặn truy cập tới mọi endpoint của hệ thống. Có thể đặt thời hạn hoặc chặn vĩnh viễn.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="block-ip">Địa chỉ IP <span className="text-rose-500">*</span></Label>
            <Input
              id="block-ip"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="192.168.1.1 hoặc 2001:db8::1"
              className="font-mono"
              disabled={mut.isPending}
            />
            <p className="text-xs text-muted-foreground">Hỗ trợ cả IPv4 và IPv6.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="block-reason">Lý do <span className="text-muted-foreground/60">(tùy chọn)</span></Label>
            <Textarea
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Spam đăng ký nhiều lần"
              rows={2}
              maxLength={500}
              disabled={mut.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Thời hạn chặn</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TTL_PRESETS).map(([key, preset]) => {
                const active = ttlMode === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTtlMode(key)}
                    disabled={mut.isPending}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={mut.isPending || !ip.trim()} variant="destructive">
            {mut.isPending ? "Đang chặn..." : "Chặn truy cập"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
