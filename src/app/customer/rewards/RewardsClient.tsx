"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  IconDollarCircle,
  IconSearch,
  IconCircleCheck,
  IconArrowDownToLine,
  IconLoader,
} from "@/components/icons"
import { useRewards } from "@/hooks/use-rewards"
import { cn } from "@/lib/utils"

function formatPoints(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n)
}

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}

function formatTime(d: Date | string) {
  const date = new Date(d)
  const t = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  const day = date.toLocaleDateString("vi-VN")
  return `${t} ${day}`
}

export function RewardsClient() {
  const { collapsed } = useSidebar()
  const r = useRewards()

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">
          <div className="space-y-6">
            <PageHeader />

            {/* Stats */}
            <StatsRow
              points={r.summary?.points ?? 0}
              earned={r.summary?.totalEarned ?? 0}
              redeemed={r.summary?.totalRedeemed ?? 0}
              isLoading={r.isLoadingSummary}
            />

            {/* Redeem form */}
            <RedeemForm
              isLoading={r.isLoadingConfig}
              enabled={r.enabled}
              minRedeem={r.minRedeem}
              rate={r.rate}
              redeemInput={r.redeemInput}
              setRedeemInput={r.setRedeemInput}
              redeemPoints={r.redeemPoints}
              willReceive={r.willReceive}
              canRedeem={r.canRedeem}
              points={r.points}
              onRedeem={r.onRedeem}
              isRedeeming={r.isRedeeming}
            />

            {/* History */}
            <HistorySection r={r} />
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div>
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
        <a href="/dashboard" className="hover:text-foreground transition-colors">
          Trang chủ
        </a>
        <span>/</span>
        <span className="text-foreground font-medium">Điểm thưởng</span>
      </nav>
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white">
          <IconDollarCircle size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Điểm thưởng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Đổi điểm tích lũy sang số dư ví. Mua dịch vụ tại web để tích thêm điểm.
          </p>
        </div>
      </div>
    </div>
  )
}

function StatsRow({
  points,
  earned,
  redeemed,
  isLoading,
}: {
  points: number
  earned: number
  redeemed: number
  isLoading: boolean
}) {
  const stats = [
    {
      label: "Điểm thưởng hiện tại",
      value: points,
      cls: "from-amber-400 to-orange-500",
    },
    {
      label: "Tổng điểm đã nhận",
      value: earned,
      cls: "from-emerald-400 to-teal-500",
    },
    {
      label: "Tổng điểm đã đổi",
      value: redeemed,
      cls: "from-blue-400 to-indigo-500",
    },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border bg-card p-5 flex items-start justify-between gap-4 shadow-sm"
        >
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {formatPoints(s.value)}
              </p>
            )}
          </div>
          <div
            className={cn(
              "size-9 rounded-lg flex items-center justify-center text-white shrink-0 bg-gradient-to-br",
              s.cls
            )}
          >
            <IconDollarCircle size={16} />
          </div>
        </div>
      ))}
    </div>
  )
}

function RedeemForm({
  isLoading,
  enabled,
  minRedeem,
  rate,
  redeemInput,
  setRedeemInput,
  redeemPoints,
  willReceive,
  canRedeem,
  points,
  onRedeem,
  isRedeeming,
}: {
  isLoading: boolean
  enabled: boolean
  minRedeem: number
  rate: number
  redeemInput: string
  setRedeemInput: (v: string) => void
  redeemPoints: number
  willReceive: number
  canRedeem: boolean
  points: number
  onRedeem: () => void
  isRedeeming: boolean
}) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <IconArrowDownToLine size={16} className="text-primary" />
        </div>
        <h3 className="text-base font-bold">Đổi điểm thưởng sang số dư</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : !enabled ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Tính năng đổi điểm hiện tại đang tạm dừng. Vui lòng quay lại sau.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Tỷ lệ</span>
              <span className="font-semibold tabular-nums">
                1 điểm = {formatVnd(rate)}
              </span>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Tối thiểu</span>
              <span className="font-semibold tabular-nums">
                {formatPoints(minRedeem)} điểm
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Input
                type="text"
                inputMode="numeric"
                placeholder={`Tối thiểu ${formatPoints(minRedeem)} điểm`}
                value={
                  redeemInput
                    ? parseInt(redeemInput.replace(/\D/g, "") || "0").toLocaleString("vi-VN")
                    : ""
                }
                onChange={(e) => setRedeemInput(e.target.value.replace(/\D/g, ""))}
                className="h-11 text-lg font-medium pr-20"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:underline"
                onClick={() => setRedeemInput(String(points))}
                disabled={points <= 0}
              >
                Tối đa
              </button>
            </div>

            {redeemPoints > 0 && (
              <div className="text-xs text-muted-foreground">
                Sẽ nhận về:{" "}
                <span className="font-semibold text-emerald-600 tabular-nums">
                  +{formatVnd(willReceive)}
                </span>
              </div>
            )}
          </div>

          <Button
            type="button"
            className="w-full h-11"
            disabled={!canRedeem || isRedeeming}
            onClick={onRedeem}
          >
            {isRedeeming ? (
              <>
                <IconLoader size={16} className="animate-spin mr-2" /> Đang xử lý...
              </>
            ) : (
              "Đổi điểm"
            )}
          </Button>
        </>
      )}
    </div>
  )
}

function HistorySection({ r }: { r: ReturnType<typeof useRewards> }) {
  const items = r.history?.items ?? []
  const total = r.history?.total ?? 0
  const totalPages = r.history?.totalPages ?? 1

  const filters: Array<{ key: "all" | "earn" | "redeem"; label: string }> = [
    { key: "all", label: "Tất cả" },
    { key: "earn", label: "Nhận điểm" },
    { key: "redeem", label: "Đã đổi" },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">Lịch sử điểm thưởng</h3>
          <span className="text-xs text-muted-foreground">
            {formatPoints(total)} bản ghi
          </span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const active = r.typeFilter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => r.onChangeType(f.key)}
                className={cn(
                  "h-8 px-3 rounded-full text-xs font-semibold transition-colors border",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        <form
          className="relative max-w-xs flex-1 sm:max-w-sm"
          onSubmit={(e) => {
            e.preventDefault()
            r.onSearchSubmit()
          }}
        >
          <IconSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Tìm theo nội dung..."
            value={r.searchInput}
            onChange={(e) => r.setSearchInput(e.target.value)}
            className="h-9 pl-9 pr-16"
          />
          <button
            type="submit"
            className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-1 rounded text-primary hover:bg-primary/10 transition-colors"
          >
            Tìm
          </button>
        </form>
      </div>

      {/* Table */}
      {r.isLoadingHistory ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/40 py-12 text-center text-sm text-muted-foreground">
          Chưa có giao dịch điểm thưởng nào
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((it: any) => (
            <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "size-9 rounded-full flex items-center justify-center shrink-0",
                    it.type === "earn"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-rose-500/10 text-rose-600"
                  )}
                >
                  {it.type === "earn" ? (
                    <IconCircleCheck size={16} />
                  ) : (
                    <IconArrowDownToLine size={16} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{it.content}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(it.createdAt)}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase font-bold border",
                    it.type === "earn"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                  )}
                >
                  {it.type === "earn" ? "Nhận" : "Đã đổi"}
                </Badge>
                <p
                  className={cn(
                    "text-sm font-bold tabular-nums mt-1",
                    it.pointsChange >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {it.pointsChange >= 0 ? "+" : ""}
                  {formatPoints(it.pointsChange)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Trang {r.page} / {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => r.setPage(Math.max(1, r.page - 1))}
              disabled={r.page === 1}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => r.setPage(Math.min(totalPages, r.page + 1))}
              disabled={r.page === totalPages}
            >
              Sau
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
