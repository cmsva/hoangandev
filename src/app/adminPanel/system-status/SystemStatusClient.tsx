"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

// ─── Inline icons ────────────────────────────────────────────────────────────
function IconCpu({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  )
}
function IconRam({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10v4M10 10v4M14 10v4M18 10v4" />
    </svg>
  )
}
function IconDisk({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="22" y1="12" x2="2" y2="12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
      <line x1="6" y1="16" x2="6.01" y2="16" />
      <line x1="10" y1="16" x2="10.01" y2="16" />
    </svg>
  )
}
function IconClock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
function IconActivity({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface SystemStatus {
  cpu: { percent: number; model: string; cores: number }
  ram: { percent: number; used: string; total: string }
  disk: { percent: number; used: string; free: string; total: string }
  uptime: { formatted: string; seconds: number }
  system: { hostname: string; platform: string; kernel: string; nodeVersion: string }
}
interface HistoryPoint {
  time: string
  cpu: number
  ram: number
}

const POLL_INTERVAL = 3000
const MAX_HISTORY = 30

const perfChartConfig: ChartConfig = {
  cpu: { label: "CPU", color: "oklch(0.62 0.18 235)" },
  ram: { label: "RAM", color: "oklch(0.65 0.22 25)" },
}
const diskChartConfig: ChartConfig = {
  used: { label: "Đã dùng", color: "var(--primary)" },
  free: { label: "Còn trống", color: "oklch(0.92 0.01 250)" },
}

// ─── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  badge,
  progress,
  hint,
}: {
  icon: React.ReactNode
  iconColor: string
  iconBg: string
  label: string
  value: string
  badge?: string
  progress?: number
  hint?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={cn("flex size-12 items-center justify-center rounded-xl", iconBg)}>
          <span className={cn("size-6", iconColor)}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            {badge !== undefined && (
              <span className="inline-flex items-center rounded-sm bg-primary/15 px-1 py-0.5 text-[8px] font-black uppercase text-primary">
                {badge}
              </span>
            )}
          </div>
          <div className="truncate text-xl font-bold leading-none tabular-nums text-foreground">
            {value}
          </div>
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-primary/15">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
      {hint && (
        <p className="mt-2 truncate text-[10px] italic text-muted-foreground/70">{hint}</p>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export function SystemStatusClient() {
  const [status, setStatus] = React.useState<SystemStatus | null>(null)
  const [history, setHistory] = React.useState<HistoryPoint[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/system-status", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed")
      const data: SystemStatus = await res.json()
      setStatus(data)
      setError(null)

      const now = new Date()
      const timeStr = now.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      setHistory((prev) => {
        const next = [...prev, { time: timeStr, cpu: data.cpu.percent, ram: data.ram.percent }]
        return next.slice(-MAX_HISTORY)
      })
    } catch {
      setError("Không thể kết nối tới server")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchStatus()
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchStatus])

  const uptimeAgo = status
    ? (() => {
        const s = status.uptime.seconds
        if (s < 60) return `${Math.floor(s)}s ago`
        if (s < 3600) return `${Math.floor(s / 60)}m ago`
        if (s < 86400) return `${Math.floor(s / 3600)}h ago`
        return `${Math.floor(s / 86400)}d ago`
      })()
    : ""

  const diskChartData = status
    ? [
        { name: "free", value: 100, fill: "var(--color-free)" },
        { name: "used", value: status.disk.percent, fill: "var(--color-used)" },
      ]
    : []

  if (loading && !status) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          <div className="h-7 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="h-[420px] animate-pulse rounded-xl border border-border bg-muted/40" />
          <div className="h-[420px] animate-pulse rounded-xl border border-border bg-muted/40" />
        </div>
      </div>
    )
  }

  if (error && !status) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <IconActivity className="mx-auto size-10 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb + Title ─── */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href="/adminPanel/dashboard" className="transition-colors hover:text-foreground">
            Admin
          </a>
          <span>/</span>
          <span>Hệ thống</span>
          <span>/</span>
          <span className="font-medium text-foreground">Trạng thái hệ thống</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconActivity className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trạng thái hệ thống</h1>
            <p className="text-sm text-muted-foreground">
              Giám sát realtime CPU, RAM, ổ đĩa và thời gian hoạt động.
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live · {POLL_INTERVAL / 1000}s
          </span>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<IconCpu className="size-6" />}
          iconColor="text-blue-500"
          iconBg="bg-blue-500/10"
          label="CPU Usage"
          value={`${status.cpu.percent}%`}
          badge={`${status.cpu.cores} cores`}
          progress={status.cpu.percent}
          hint={status.cpu.model}
        />
        <MetricCard
          icon={<IconRam className="size-6" />}
          iconColor="text-violet-500"
          iconBg="bg-violet-500/10"
          label="RAM Usage"
          value={`${status.ram.percent}%`}
          badge={`${status.ram.percent}%`}
          progress={status.ram.percent}
          hint={`${status.ram.used} / ${status.ram.total}`}
        />
        <MetricCard
          icon={<IconDisk className="size-6" />}
          iconColor="text-orange-500"
          iconBg="bg-orange-500/10"
          label="Disk Storage"
          value={`${status.disk.percent}%`}
          badge={`${status.disk.percent}%`}
          progress={status.disk.percent}
          hint={`${status.disk.free} free / ${status.disk.total}`}
        />
        <MetricCard
          icon={<IconClock className="size-6" />}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
          label="Uptime"
          value={status.uptime.formatted}
          hint={`Live since ${uptimeAgo}`}
        />
      </div>

      {/* ─── Charts ─── */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {/* Performance area chart */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold">Hiệu năng hệ thống</span>
              <span className="inline-flex h-4 animate-pulse items-center rounded-sm bg-primary/15 px-2 text-[8px] font-black uppercase tracking-wider text-primary">
                Live
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: "oklch(0.62 0.18 235)" }} />
                CPU
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: "oklch(0.65 0.22 25)" }} />
                RAM
              </span>
            </div>
          </div>
          <div className="px-6 py-6">
            <ChartContainer config={perfChartConfig} className="aspect-auto h-[320px] w-full">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="gradient-cpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-cpu)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-cpu)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradient-ram" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-ram)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-ram)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  fontWeight={500}
                  opacity={0.5}
                  minTickGap={32}
                />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="var(--color-cpu)"
                  fill="url(#gradient-cpu)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="ram"
                  stroke="var(--color-ram)"
                  fill="url(#gradient-ram)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        {/* Right column: disk + system info */}
        <div className="flex flex-col gap-6">
          {/* Disk radial */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <div className="text-base font-bold">Lưu trữ ổ đĩa</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Disk Resource Distribution
              </div>
            </div>
            <div className="flex flex-col items-center px-6 py-6">
              <ChartContainer config={diskChartConfig} className="mx-auto aspect-square w-full max-h-[220px]">
                <RadialBarChart
                  innerRadius="60%"
                  outerRadius="100%"
                  data={diskChartData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar dataKey="value" background cornerRadius={6} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                </RadialBarChart>
              </ChartContainer>
              <div className="mt-3 w-full space-y-2 px-2">
                <div className="flex items-center justify-between border-b border-border/30 py-2">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Đã dùng
                    </span>
                  </div>
                  <span className="text-xs font-black tabular-nums">{status.disk.used}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-muted-foreground/30" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Còn trống
                    </span>
                  </div>
                  <span className="text-xs font-black tabular-nums">{status.disk.free}</span>
                </div>
              </div>
            </div>
          </div>

          {/* System info */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <div className="text-base font-bold">Thông tin hệ thống</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Server Information
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-6 py-6 sm:grid-cols-2">
              <InfoRow label="Hostname" value={status.system.hostname} mono />
              <InfoRow label="Platform" value={status.system.platform} />
              <InfoRow label="Kernel" value={status.system.kernel} mono small />
              <InfoRow label="Node.js" value={status.system.nodeVersion} highlight />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono,
  small,
  highlight,
}: {
  label: string
  value: string
  mono?: boolean
  small?: boolean
  highlight?: boolean
}) {
  return (
    <div className="space-y-1">
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <div
        className={cn(
          "truncate rounded border border-border/40 bg-muted/40 px-2 py-1.5",
          mono && "font-mono",
          small ? "text-[11px]" : "text-sm font-semibold",
          highlight && "border-primary/20 bg-primary/5 font-bold text-primary"
        )}
      >
        {value}
      </div>
    </div>
  )
}
