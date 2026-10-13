import { Area, AreaChart, ResponsiveContainer } from "recharts"

interface StatCardProps {
  title: string
  value: string
  trend: string
  trendUp: boolean
  sparkData: number[]
  icon: React.ReactNode
  iconBg: string
}

export function StatCard({ title, value, trend, trendUp, sparkData, icon, iconBg }: StatCardProps) {
  const data = sparkData.map((v, i) => ({ value: v, index: i }))
  const gradientId = `spark-${title.replace(/\s/g, "-").toLowerCase()}`

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-sidebar-primary/30 hover:shadow-lg hover:shadow-sidebar-primary/5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-muted-foreground">{title}</span>
          <span className="text-2xl font-bold tracking-tight text-card-foreground">{value}</span>
          {trend && (
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trendUp ? "text-[oklch(0.62_0.17_145)]" : "text-destructive"}`}>
                {trendUp ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/></svg>
                )}
                {trend}
              </span>
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 h-[48px]" style={{ minHeight: 48 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.65 0.19 160)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="oklch(0.65 0.19 160)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="oklch(0.65 0.19 160)"
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
