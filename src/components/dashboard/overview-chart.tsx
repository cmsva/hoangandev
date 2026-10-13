"use client"

import { useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const data = [
  { month: "Jan", revenue: 18000, orders: 420, profit: 8200 },
  { month: "Feb", revenue: 22000, orders: 480, profit: 10500 },
  { month: "Mar", revenue: 19500, orders: 390, profit: 9100 },
  { month: "Apr", revenue: 24000, orders: 520, profit: 11800 },
  { month: "May", revenue: 28000, orders: 580, profit: 13200 },
  { month: "Jun", revenue: 32000, orders: 640, profit: 15600 },
  { month: "Jul", revenue: 30000, orders: 610, profit: 14200 },
  { month: "Aug", revenue: 35000, orders: 720, profit: 17100 },
  { month: "Sep", revenue: 38000, orders: 780, profit: 18900 },
  { month: "Oct", revenue: 42000, orders: 850, profit: 21000 },
  { month: "Nov", revenue: 45000, orders: 920, profit: 22500 },
  { month: "Dec", revenue: 48295, orders: 980, profit: 24100 },
]

const tabs = [
  { key: "revenue", label: "Revenue" },
  { key: "orders", label: "Orders" },
  { key: "profit", label: "Profit" },
] as const

type TabKey = (typeof tabs)[number]["key"]

export function OverviewChart() {
  const [activeTab, setActiveTab] = useState<TabKey>("revenue")

  const formatValue = (value: number) => {
    if (activeTab === "orders") return value.toLocaleString()
    return `$${(value / 1000).toFixed(0)}k`
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Overview</h3>
          <p className="text-sm text-muted-foreground">
            Monthly performance for the current year
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.65 0.19 160)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="oklch(0.65 0.19 160)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.28 0 0)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "oklch(0.556 0.015 230)", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "oklch(0.556 0.015 230)", fontSize: 12 }}
              tickFormatter={(v) => (activeTab === "orders" ? v : `$${v / 1000}k`)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.13 0 0)",
                border: "1px solid oklch(0.28 0 0)",
                borderRadius: "8px",
                color: "oklch(0.985 0 0)",
              }}
              formatter={(value) => [formatValue(value as number), activeTab]}
            />
            <Area
              type="monotone"
              dataKey={activeTab}
              stroke="oklch(0.65 0.19 160)"
              strokeWidth={2.5}
              fill="url(#chartGradient)"
              dot={false}
              activeDot={{ r: 5, fill: "oklch(0.65 0.19 160)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
