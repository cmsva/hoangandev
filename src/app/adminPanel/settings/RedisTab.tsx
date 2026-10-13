"use client"

import * as React from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  IconDatabase,
  IconCircleCheck,
  IconAlertWarning,
  IconLoader,
  IconTrash,
  IconSearch,
  IconTrendingUp,
  IconClock,
  IconChevronRight,
} from "@/components/icons"
import { cn } from "@/lib/utils"

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatBytes(n: number): string {
  if (n === 0) return "0 B"
  const k = 1024
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(k)))
  return `${(n / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n)
}

function formatTtl(ttl: number): string {
  if (ttl === -1) return "không hết hạn"
  if (ttl === -2) return "đã hết hạn"
  if (ttl < 60) return `${ttl}s`
  if (ttl < 3600) return `${Math.round(ttl / 60)}m`
  return `${(ttl / 3600).toFixed(1)}h`
}

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
}

// ─── Stat Card ────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  hint,
  icon,
  highlight,
}: {
  label: string
  value: string
  hint?: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

// ─── Status Banner ────────────────────────────────────────────────────────
function StatusBanner({
  configured,
  healthy,
  url,
  namespace,
}: {
  configured: boolean
  healthy: boolean
  url: string | null
  namespace: string
}) {
  if (!configured) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
        <IconAlertWarning size={20} className="mt-0.5 shrink-0 text-yellow-600" />
        <div className="space-y-1">
          <div className="font-semibold text-foreground">Redis chưa được cấu hình</div>
          <div className="text-sm text-muted-foreground">
            Đặt biến môi trường <code className="rounded bg-muted px-1.5 py-0.5 text-xs">REDIS_URL</code> trong file <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env</code> và restart server. App vẫn hoạt động bình thường, chỉ là không có cache layer.
          </div>
        </div>
      </div>
    )
  }
  if (!healthy) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <IconAlertWarning size={20} className="mt-0.5 shrink-0 text-red-600" />
        <div className="space-y-1">
          <div className="font-semibold text-foreground">Mất kết nối Redis</div>
          <div className="text-sm text-muted-foreground">
            App tự fallback đọc thẳng MongoDB nên vẫn hoạt động. Hệ thống sẽ tự reconnect khi Redis online lại.
          </div>
          {url && <div className="font-mono text-xs text-muted-foreground">{url}</div>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
      <IconCircleCheck size={20} className="mt-0.5 shrink-0 text-green-600" />
      <div className="flex-1 space-y-1">
        <div className="font-semibold text-foreground">Redis đang hoạt động</div>
        {url && <div className="font-mono text-xs text-muted-foreground">{url}</div>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Namespace của site này:</span>
          <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">{namespace}:*</code>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────
export function RedisTab() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    ...trpc.adminRedis.status.queryOptions(),
    refetchInterval: 5_000, // refresh stats mỗi 5s
  })

  const [pattern, setPattern] = React.useState("")
  const [searchInput, setSearchInput] = React.useState("")
  const [cursor, setCursor] = React.useState<string>("0")
  const [keys, setKeys] = React.useState<Array<{ key: string; type: string; ttl: number; sizeBytes: number }>>([])
  const [done, setDone] = React.useState(false)
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null)

  const keysQuery = useQuery({
    ...trpc.adminRedis.listKeys.queryOptions({ pattern: pattern || "*", cursor, count: 100 }),
    enabled: statusQuery.data?.healthy ?? false,
  })

  React.useEffect(() => {
    if (!keysQuery.data) return
    if (cursor === "0") {
      setKeys(keysQuery.data.items)
    } else {
      setKeys((prev) => [...prev, ...keysQuery.data.items])
    }
    setDone(keysQuery.data.done)
  }, [keysQuery.data, cursor])

  const detailQuery = useQuery({
    ...trpc.adminRedis.getKey.queryOptions({ key: selectedKey || "" }),
    enabled: !!selectedKey,
  })

  const deleteKeyMut = useMutation({
    ...trpc.adminRedis.deleteKey.mutationOptions(),
    onSuccess: (data) => {
      if (data?.deleted) toast.success("Đã xóa key")
      else toast.error("Xóa thất bại")
      setSelectedKey(null)
      setCursor("0")
      queryClient.invalidateQueries({ queryKey: trpc.adminRedis.status.queryOptions().queryKey })
      queryClient.invalidateQueries({ queryKey: trpc.adminRedis.listKeys.queryOptions({ pattern: pattern || "*", cursor: "0", count: 100 }).queryKey })
    },
  })

  const deletePrefixMut = useMutation({
    ...trpc.adminRedis.deletePrefix.mutationOptions(),
    onSuccess: (data) => {
      toast.success(`Đã xóa ${data?.deleted ?? 0} key`)
      setCursor("0")
      queryClient.invalidateQueries({ queryKey: trpc.adminRedis.status.queryOptions().queryKey })
      queryClient.invalidateQueries({ queryKey: trpc.adminRedis.listKeys.queryOptions({ pattern: pattern || "*", cursor: "0", count: 100 }).queryKey })
    },
  })

  const flushMut = useMutation({
    ...trpc.adminRedis.flushAll.mutationOptions(),
    onSuccess: (data) => {
      if (data?.flushed) toast.success("Đã flush toàn bộ cache")
      else toast.error("Flush thất bại")
      setCursor("0")
      queryClient.invalidateQueries({ queryKey: trpc.adminRedis.status.queryOptions().queryKey })
      queryClient.invalidateQueries({ queryKey: trpc.adminRedis.listKeys.queryOptions({ pattern: pattern || "*", cursor: "0", count: 100 }).queryKey })
    },
  })

  const resetStatsMut = useMutation({
    ...trpc.adminRedis.resetStats.mutationOptions(),
    onSuccess: () => {
      toast.success("Đã reset thống kê")
      queryClient.invalidateQueries({ queryKey: trpc.adminRedis.status.queryOptions().queryKey })
    },
  })

  const handleSearch = () => {
    setPattern(searchInput.trim())
    setCursor("0")
    setKeys([])
  }

  const handleLoadMore = () => {
    if (keysQuery.data && !done) {
      setCursor(keysQuery.data.nextCursor)
    }
  }

  const handleDeletePrefix = () => {
    const prefix = searchInput.trim().replace(/\*$/, "")
    if (!prefix) {
      toast.error("Nhập prefix vào ô search trước")
      return
    }
    if (!confirm(`Xóa tất cả key bắt đầu với "${prefix}"?`)) return
    deletePrefixMut.mutate({ prefix })
  }

  const handleFlush = () => {
    if (!confirm("Xóa TOÀN BỘ cache Redis? Action này không thể undo.")) return
    flushMut.mutate()
  }

  if (statusQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const status = statusQuery.data
  if (!status) return null

  const cacheStats = status.cacheStats
  const speedupPct = Math.round(cacheStats.speedupPercent)
  const hitRatePct = Math.round(cacheStats.hitRate * 100)

  return (
    <div className="space-y-6">
      <StatusBanner
        configured={status.configured}
        healthy={status.healthy}
        url={status.url}
        namespace={status.namespace}
      />

      {/* ─── Cache Stats ─── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Hiệu suất cache (in-process)</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => resetStatsMut.mutate()}
            disabled={resetStatsMut.isPending}
          >
            Reset
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Tăng tốc"
            value={`${speedupPct}%`}
            hint={`Hit ${cacheStats.avgHitMs.toFixed(1)}ms · Miss ${cacheStats.avgMissMs.toFixed(1)}ms`}
            icon={<IconTrendingUp size={14} />}
            highlight={speedupPct > 50}
          />
          <StatCard
            label="Hit rate"
            value={`${hitRatePct}%`}
            hint={`${formatNumber(cacheStats.hits)}/${formatNumber(cacheStats.total)} requests`}
            icon={<IconCircleCheck size={14} />}
          />
          <StatCard
            label="Cache hits"
            value={formatNumber(cacheStats.hits)}
            hint={`${formatNumber(cacheStats.misses)} misses · ${formatNumber(cacheStats.errors)} errors`}
            icon={<IconDatabase size={14} />}
          />
          <StatCard
            label="Uptime"
            value={formatUptime(cacheStats.uptimeSec)}
            hint="từ lần reset stats gần nhất"
            icon={<IconClock size={14} />}
          />
        </div>
      </div>

      {/* ─── Server Info ─── */}
      {status.healthy && (
        <div>
          <h3 className="mb-3 text-base font-semibold text-foreground">Thông tin Redis server</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Memory"
              value={status.serverInfo.usedMemoryHuman || "—"}
              hint={`${formatNumber(status.serverInfo.siteKeys ?? 0)} keys của site / ${formatNumber(status.serverInfo.dbSize ?? 0)} tổng`}
              icon={<IconDatabase size={14} />}
            />
            <StatCard
              label="Ops / giây"
              value={formatNumber(status.serverInfo.instantaneousOpsPerSec ?? 0)}
              hint={`${formatNumber(status.serverInfo.totalCommandsProcessed ?? 0)} total`}
              icon={<IconTrendingUp size={14} />}
            />
            <StatCard
              label="Server hit rate"
              value={`${Math.round((status.serverInfo.keyHitRate ?? 0) * 100)}%`}
              hint={`${formatNumber(status.serverInfo.keyspaceHits ?? 0)} hits · ${formatNumber(status.serverInfo.keyspaceMisses ?? 0)} misses`}
              icon={<IconCircleCheck size={14} />}
            />
            <StatCard
              label="Server uptime"
              value={formatUptime(status.serverInfo.uptimeSec ?? 0)}
              hint={`v${status.serverInfo.version ?? "?"} · ${status.serverInfo.role ?? ""}`}
              icon={<IconClock size={14} />}
            />
          </div>
        </div>
      )}

      {/* ─── Key Manager ─── */}
      {status.healthy && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-foreground">Quản lý keys</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDeletePrefix}
                disabled={deletePrefixMut.isPending || !searchInput.trim()}
              >
                {deletePrefixMut.isPending ? <IconLoader size={14} className="animate-spin" /> : <IconTrash size={14} />}
                Xóa theo prefix
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleFlush}
                disabled={flushMut.isPending}
              >
                {flushMut.isPending ? <IconLoader size={14} className="animate-spin" /> : <IconTrash size={14} />}
                Flush toàn bộ
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Pattern (vd: auth:user:*, settings:*, captcha:*)"
                className="pl-9"
              />
            </div>
            <Button type="button" size="sm" onClick={handleSearch}>
              Tìm
            </Button>
          </div>

          {/* Key List + Detail */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* List */}
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>{keys.length} key</span>
                {!done && <span>còn nữa…</span>}
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {keys.length === 0 && !keysQuery.isLoading && (
                  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                    Chưa có key nào
                  </div>
                )}
                {keys.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => setSelectedKey(k.key)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                      selectedKey === k.key && "bg-primary/5"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs text-foreground">{k.key}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium uppercase">{k.type}</span>
                        <span>TTL {formatTtl(k.ttl)}</span>
                        <span>{formatBytes(k.sizeBytes)}</span>
                      </div>
                    </div>
                    <IconChevronRight size={14} className="shrink-0 text-muted-foreground/50" />
                  </button>
                ))}
              </div>
              {!done && (
                <div className="border-t border-border bg-muted/20 p-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={handleLoadMore}
                    disabled={keysQuery.isFetching}
                  >
                    {keysQuery.isFetching ? "Đang tải…" : "Tải thêm"}
                  </Button>
                </div>
              )}
            </div>

            {/* Detail */}
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Chi tiết key</span>
                {selectedKey && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteKeyMut.mutate({ key: selectedKey })}
                    disabled={deleteKeyMut.isPending}
                  >
                    {deleteKeyMut.isPending ? <IconLoader size={12} className="animate-spin" /> : <IconTrash size={12} />}
                    Xóa
                  </Button>
                )}
              </div>
              <div className="p-3">
                {!selectedKey && (
                  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                    Chọn 1 key để xem chi tiết
                  </div>
                )}
                {selectedKey && detailQuery.isLoading && (
                  <Skeleton className="h-32 w-full rounded-md" />
                )}
                {selectedKey && detailQuery.data && (
                  <div className="space-y-3">
                    <div className="font-mono text-xs text-foreground break-all">{detailQuery.data.key}</div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded bg-muted px-2 py-0.5 font-medium uppercase">{detailQuery.data.type}</span>
                      <span className="text-muted-foreground">TTL: {formatTtl(detailQuery.data.ttl)}</span>
                      <span className="text-muted-foreground">{formatBytes(detailQuery.data.sizeBytes)}</span>
                    </div>
                    {detailQuery.data.preview && (
                      <pre className="max-h-[320px] overflow-auto rounded-md bg-muted/50 p-3 text-xs text-foreground">
                        {detailQuery.data.preview}
                      </pre>
                    )}
                  </div>
                )}
                {selectedKey && !detailQuery.isLoading && !detailQuery.data && (
                  <div className="text-sm text-muted-foreground">Key không tồn tại hoặc đã bị xóa.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
