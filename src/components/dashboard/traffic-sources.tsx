import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

const data = [
  { name: "Direct", value: 35, color: "oklch(0.65 0.19 160)" },
  { name: "Organic", value: 28, color: "oklch(0.55 0.15 200)" },
  { name: "Referral", value: 22, color: "oklch(0.70 0.12 85)" },
  { name: "Social", value: 15, color: "oklch(0.60 0.20 300)" },
]

export function TrafficSources() {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Traffic Sources</h3>
        <p className="text-sm text-muted-foreground">Where your visitors come from</p>
      </div>
      <div className="flex items-center justify-center">
        <div className="relative h-[180px] w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">284K</span>
            <span className="text-xs text-muted-foreground">visits</span>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-muted-foreground">{item.name}</span>
            </div>
            <span className="text-sm font-medium">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
