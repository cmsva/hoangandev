"use client"

import { useEffect, useState } from "react"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { SelectCustom } from "@/components/ui/select-custom"
import { BalanceChartSkeleton } from "@/components/dashboard/dashboard-skeletons"

type FilterType = "all" | "deposit" | "spending"

const COLOR_DEPOSIT = "oklch(0.62 0.18 235)" // xanh dương
const COLOR_SPENDING = "oklch(0.65 0.22 25)" // đỏ

export function BalanceChart() {
  const [filter, setFilter] = useState<FilterType>("all")
  const trpc = useTRPC()
  const { data: transactions, isLoading } = useQuery(
    trpc.dashboard.chartData.queryOptions()
  ) as { data: any[] | undefined; isLoading: boolean }

  // Animation key — Recharts re-mount để chạy animation từ baseline khi
  // data về lần đầu hoặc đổi filter
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    if (transactions) {
      const id = requestAnimationFrame(() => setAnimKey((k) => k + 1))
      return () => cancelAnimationFrame(id)
    }
  }, [transactions, filter])

  if (isLoading) {
    return <BalanceChartSkeleton />
  }

  const chartData = transactions || []
  const showDeposit = filter === "all" || filter === "deposit"
  const showSpending = filter === "all" || filter === "spending"

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* Header with filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Thống kê giao dịch</h3>
          <p className="text-sm text-muted-foreground">Biến động số dư theo thời gian</p>
        </div>
        <div className="flex items-center gap-2">
          <SelectCustom
            value={filter}
            onValueChange={(v) => setFilter(v as FilterType)}
            className="w-[140px]"
            placeholder="Tất cả"
            options={[
              { value: "all", label: "Tất cả" },
              { value: "deposit", label: "Nạp tiền" },
              { value: "spending", label: "Chi tiêu" },
            ]}
          />
        </div>
      </div>

      {/* Chart */}
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart key={animKey} data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="depositGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR_DEPOSIT} stopOpacity={0.32} />
                <stop offset="100%" stopColor={COLOR_DEPOSIT} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR_SPENDING} stopOpacity={0.32} />
                <stop offset="100%" stopColor={COLOR_SPENDING} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.1)" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "oklch(0.5 0 0)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "oklch(0.5 0 0)" }}
              tickFormatter={(v) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(0)}M`
                  : v >= 1_000
                  ? `${(v / 1_000).toFixed(0)}K`
                  : v
              }
            />
            <Tooltip
              cursor={{ stroke: "oklch(0.5 0 0 / 0.2)", strokeWidth: 1, strokeDasharray: "3 3" }}
              contentStyle={{
                backgroundColor: "oklch(0.13 0 0)",
                border: "1px solid oklch(0.28 0 0)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#fff",
              }}
              formatter={(value: any, name: any) => [
                `${Number(value).toLocaleString()}đ`,
                name === "deposit" ? "Nạp tiền" : "Chi tiêu",
              ]}
            />
            {showDeposit && (
              <Area
                type="monotone"
                dataKey="deposit"
                name="deposit"
                stroke={COLOR_DEPOSIT}
                strokeWidth={2}
                fill="url(#depositGradient)"
                dot={false}
                activeDot={{ r: 4, fill: COLOR_DEPOSIT, stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive
                animationBegin={0}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            )}
            {showSpending && (
              <Area
                type="monotone"
                dataKey="spending"
                name="spending"
                stroke={COLOR_SPENDING}
                strokeWidth={2}
                fill="url(#spendingGradient)"
                dot={false}
                activeDot={{ r: 4, fill: COLOR_SPENDING, stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive
                animationBegin={200}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend / Quick filters */}
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => setFilter("deposit")}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${filter === "deposit" ? "bg-[oklch(0.62_0.18_235)]/10 text-[oklch(0.62_0.18_235)]" : "text-muted-foreground hover:text-foreground"}`}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: COLOR_DEPOSIT }} />
          Nạp tiền
        </button>
        <button
          onClick={() => setFilter("spending")}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${filter === "spending" ? "bg-red-500/10 text-red-500" : "text-muted-foreground hover:text-foreground"}`}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: COLOR_SPENDING }} />
          Chi tiêu
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${filter === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <span className="h-2 w-2 rounded-full bg-primary" />
          Tất cả
        </button>
      </div>
    </div>
  )
}
