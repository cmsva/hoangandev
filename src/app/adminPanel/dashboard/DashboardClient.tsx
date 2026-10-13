"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  Tooltip,
} from "recharts"
import {
  IconUsers,
  IconWallet,
  IconBracketsCurly,
  IconLink,
  IconBrush,
  IconClock,
  IconMonitor,
  IconAlertWarning,
  IconCreditCard,
} from "@/components/icons"
import type { ComponentType } from "react"

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}
function formatNum(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n)
}

const RANGES = [
  { key: "today", label: "Hôm nay" },
  { key: "week", label: "Tuần này" },
  { key: "month", label: "Tháng này" },
  { key: "year", label: "Năm này" },
  { key: "all", label: "Toàn thời gian" },
] as const

type RangeKey = (typeof RANGES)[number]["key"]

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({
  Icon,
  label,
  value,
  color = "text-primary",
  bg = "bg-primary/10",
}: {
  Icon: ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  color?: string
  bg?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center gap-3">
        <div className={`shrink-0 size-12 flex items-center justify-center rounded-lg ${bg} ${color}`}>
          <Icon size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mb-0.5 truncate">
            {label}
          </div>
          <div className="text-foreground max-w-full truncate text-[20px] font-extrabold tabular-nums leading-tight">
            {value}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Time range picker (dialog) ────────────────────────────────────────────

function TimeRangeDialog({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean
  value: RangeKey
  onChange: (v: RangeKey) => void
  onClose: () => void
}) {
  const [pending, setPending] = useState<RangeKey>(value)

  function apply() {
    onChange(pending)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconClock size={18} className="text-primary" />
            Chọn khoảng thời gian
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 py-2">
          {RANGES.map((r) => {
            const active = r.key === pending
            return (
              <button
                key={r.key}
                onClick={() => setPending(r.key)}
                className={`flex items-center justify-center rounded-lg border p-3 text-sm font-semibold transition-all ${active
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "bg-background hover:bg-accent text-foreground"
                  }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={apply}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Áp dụng
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function AdminDashboardClient() {
  const trpc = useTRPC()
  const [range, setRange] = useState<RangeKey>("today")
  const [pickerOpen, setPickerOpen] = useState(false)

  const { data: stats, isLoading } = useQuery(
    trpc.admin.getStats.queryOptions({ range }, { staleTime: 60_000 })
  ) as { data: any; isLoading: boolean }

  return (
    <div className="space-y-5">
      {/* ─── Pill "Hôm nay" — click → Dialog ─── */}
      <div className="flex justify-center py-2">
        <button
          onClick={() => setPickerOpen(true)}
          className="group inline-flex items-center gap-2 rounded-full border bg-card px-5 py-2 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
          title="Chọn thời gian"
        >
          <IconClock size={18} className="text-primary" />
          <span className="text-base font-bold">{stats?.range?.label ?? "Hôm nay"}</span>
        </button>
      </div>

      <TimeRangeDialog
        open={pickerOpen}
        value={range}
        onChange={setRange}
        onClose={() => setPickerOpen(false)}
      />

      {/* Loading */}
      {isLoading && !stats && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      )}

      {stats && (
        <>
          {/* ─── Hàng 1: User & finance overview ─── */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard Icon={IconUsers} color="text-primary" bg="bg-primary/10" label="Thành viên mới" value={formatNum(stats.users)} />
            <StatCard Icon={IconWallet} color="text-emerald-600" bg="bg-emerald-500/15" label="Nạp ngân hàng" value={formatMoney(stats.revenueByChannel.invoice)} />
            <StatCard Icon={IconCreditCard} color="text-violet-600" bg="bg-violet-500/15" label="Nạp thẻ cào" value={formatMoney(stats.revenueByChannel.card)} />
            <StatCard Icon={IconAlertWarning} color="text-amber-600" bg="bg-amber-500/15" label="Hóa đơn chờ duyệt" value={formatNum(stats.pending.invoices)} />
            <StatCard Icon={IconCreditCard} color="text-rose-600" bg="bg-rose-500/15" label="Thẻ chờ duyệt" value={formatNum(stats.pending.cards)} />
          </div>

          {/* ─── Hàng 2: Đơn dịch vụ trong range ─── */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard Icon={IconBracketsCurly} color="text-purple-600" bg="bg-purple-500/15" label="Mã nguồn đã bán" value={formatNum(stats.services.sourceCode.count)} />
            <StatCard Icon={IconLink} color="text-blue-600" bg="bg-blue-500/15" label="Tên miền đăng ký" value={formatNum(stats.services.domains.count)} />
            <StatCard Icon={IconBrush} color="text-pink-600" bg="bg-pink-500/15" label="Logo đã thuê" value={formatNum(stats.services.logos.count)} />
            <StatCard Icon={IconClock} color="text-emerald-600" bg="bg-emerald-500/15" label="Cronjob đăng ký" value={formatNum(stats.services.cronjobs.count)} />
            <StatCard Icon={IconMonitor} color="text-orange-600" bg="bg-orange-500/15" label="Website đã thuê" value={formatNum(stats.services.websites.count)} />
          </div>

          {/* ─── Hàng 3: Pending dịch vụ (lifetime) ─── */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard Icon={IconBracketsCurly} color="text-purple-600" bg="bg-purple-500/15" label="Tổng MN đã bán" value={formatNum(stats.pending.sourceCodeLifetime)} />
            <StatCard Icon={IconAlertWarning} color="text-blue-600" bg="bg-blue-500/15" label="Domain chờ setup" value={formatNum(stats.pending.domains)} />
            <StatCard Icon={IconAlertWarning} color="text-pink-600" bg="bg-pink-500/15" label="Logo chờ bàn giao" value={formatNum(stats.pending.logos)} />
            <StatCard Icon={IconClock} color="text-emerald-600" bg="bg-emerald-500/15" label="Cronjob hết hạn" value={formatNum(stats.pending.cronjobsExpired)} />
            <StatCard Icon={IconAlertWarning} color="text-orange-600" bg="bg-orange-500/15" label="Website chờ setup" value={formatNum(stats.pending.websites)} />
          </div>

          {/* ─── Hàng 4: Doanh thu dịch vụ trong range ─── */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard Icon={IconWallet} color="text-purple-600" bg="bg-purple-500/15" label="DT mã nguồn" value={formatMoney(stats.services.sourceCode.revenue)} />
            <StatCard Icon={IconWallet} color="text-blue-600" bg="bg-blue-500/15" label="DT tên miền" value={formatMoney(stats.services.domains.revenue)} />
            <StatCard Icon={IconWallet} color="text-pink-600" bg="bg-pink-500/15" label="DT logo" value={formatMoney(stats.services.logos.revenue)} />
            <StatCard Icon={IconWallet} color="text-emerald-600" bg="bg-emerald-500/15" label="DT cronjob" value={formatMoney(stats.services.cronjobs.revenue)} />
            <StatCard Icon={IconWallet} color="text-orange-600" bg="bg-orange-500/15" label="DT website" value={formatMoney(stats.services.websites.revenue)} />
          </div>

          {/* ─── Charts (luôn 7 ngày) ─── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-2">
            <ChartCard title="Doanh thu" subtitle="7 ngày gần nhất" data={stats.chartDays} dataKey="revenue" formatTooltip={formatMoney} color="oklch(0.62 0.18 235)" />
            <ChartCard title="Thành viên mới" subtitle="7 ngày gần nhất" data={stats.chartDays} dataKey="members" formatTooltip={(v: number) => `${v} thành viên`} color="oklch(0.65 0.18 145)" />
          </div>

          {/* ─── Server Info Card (cuối page) ─── */}
          <ServerInfoCard />
        </>
      )}
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  data,
  dataKey,
  formatTooltip,
  color,
}: {
  title: string
  subtitle: string
  data: any[]
  dataKey: string
  formatTooltip: (v: number) => string
  color: string
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <div className="text-base font-bold">{title}</div>
        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider mt-0.5 opacity-70">
          {subtitle}
        </div>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} fontWeight={500} />
            <Tooltip
              cursor={{ fill: "currentColor", opacity: 0.05 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: any) => [formatTooltip(Number(value)), ""]}
            />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Server Info Card ─────────────────────────────────────────────────────

function formatGB(n: number) {
  if (!n || Number.isNaN(n)) return "0 GB"
  return (n / (1024 * 1024 * 1024)).toFixed(2) + " GB"
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  const safe = Math.max(0, Math.min(100, percent || 0))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/5">
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${safe}%` }}
      />
    </div>
  )
}

function Chip({ label, value, color = "text-primary" }: { label: string; value: string; color?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-[11px] font-medium ${color}`}>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}

function ServerInfoCard() {
  const trpc = useTRPC()
  const { data: srv } = useQuery(
    trpc.admin.getServerInfo.queryOptions(undefined, {
      refetchInterval: 60_000,
      staleTime: 60_000,
    } as any)
  ) as { data: any }

  if (!srv) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-card to-card p-5 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 rounded-lg border bg-primary/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IconClock size={18} className="text-primary" />
              <span className="text-sm font-semibold">Uptime</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {srv.hostname}
              </span>
              <span className="rounded bg-foreground/8 px-1.5 py-0.5 text-[10px] font-bold">
                {srv.platform} {srv.arch}
              </span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 flex-wrap">
            <div>
              <div className="text-2xl font-black tracking-tight tabular-nums">
                {srv.uptimeHuman}
              </div>
              <div className="text-[11px] text-muted-foreground">Kể từ khi khởi động OS</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                {srv.user.username}
              </span>
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 font-mono">
                {srv.network.primaryIPv4}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-amber-500/15 text-amber-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="2" x2="9" y2="4" /><line x1="15" y1="2" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="22" /><line x1="15" y1="20" x2="15" y2="22" /><line x1="20" y1="9" x2="22" y2="9" /><line x1="20" y1="14" x2="22" y2="14" /><line x1="2" y1="9" x2="4" y2="9" /><line x1="2" y1="14" x2="4" y2="14" /></svg>
            </span>
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">CPU</div>
              <div className="text-sm font-bold">{srv.cpu.cores} cores · {srv.cpu.speedMhz} MHz</div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground mb-1.5 truncate" title={srv.cpu.model}>
            {srv.cpu.model}
          </div>
          <ProgressBar percent={srv.cpu.loadPercent} color="bg-amber-500" />
          <div className="mt-1.5 flex justify-between items-center text-[10px] tabular-nums">
            <span className="text-muted-foreground">
              Load: <span className="font-bold text-foreground">{srv.cpu.load1.toFixed(2)}/{srv.cpu.load5.toFixed(2)}/{srv.cpu.load15.toFixed(2)}</span>
            </span>
            <span className="font-bold text-amber-600">{srv.cpu.loadPercent}%</span>
          </div>
        </div>

        <div className="rounded-lg border bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2" /><line x1="7" y1="6" x2="7" y2="18" /><line x1="11" y1="6" x2="11" y2="18" /><line x1="15" y1="6" x2="15" y2="18" /></svg>
            </span>
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">RAM</div>
              <div className="text-sm font-bold">{formatGB(srv.memory.used)} / {formatGB(srv.memory.total)}</div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground mb-1.5">Sử dụng bộ nhớ</div>
          <ProgressBar percent={srv.memory.usedPercent} color="bg-emerald-500" />
          <div className="mt-1.5 flex justify-between items-center text-[10px] tabular-nums">
            <span className="text-muted-foreground">
              Free: <span className="font-bold text-foreground">{formatGB(srv.memory.free)}</span>
            </span>
            <span className="font-bold text-emerald-600">{srv.memory.usedPercent}%</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2 items-center">
        <Chip label="Node" value={srv.nodeVersion} color="text-blue-600" />
        <Chip label="Endian" value={srv.endianness} />
        <Chip label="TZ" value={srv.time.timezone} />
        <Chip label="IPv6" value={srv.network.primaryIPv6} />
        <Chip label="Interfaces" value={String(srv.network.interfaceCount)} />
        <Chip label="Tmp" value={srv.tmpDir} />
        <span className="ml-auto text-[10px] text-muted-foreground italic">Auto-refresh 60s</span>
      </div>
    </div>
  )
}
