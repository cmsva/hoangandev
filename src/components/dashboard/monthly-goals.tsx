interface GoalProps {
  label: string
  current: number
  target: number
  percentage: number
  color: string
}

const goals: GoalProps[] = [
  { label: "Monthly Revenue", current: 48295, target: 55000, percentage: 88, color: "bg-primary" },
  { label: "New Customers", current: 847, target: 1000, percentage: 85, color: "bg-[oklch(0.55_0.15_200)]" },
  { label: "Conversion Rate", current: 3.5, target: 5, percentage: 70, color: "bg-[oklch(0.70_0.12_85)]" },
]

export function MonthlyGoals() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold">Monthly Goals</h3>
        <p className="text-sm text-muted-foreground">Track progress toward targets</p>
      </div>
      <div className="space-y-5">
        {goals.map((goal) => (
          <div key={goal.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{goal.label}</span>
              <span className="text-xs font-semibold text-primary">{goal.percentage}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${goal.color} transition-all duration-500`}
                style={{ width: `${goal.percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{typeof goal.current === "number" && goal.current > 100 ? goal.current.toLocaleString() : goal.current}</span>
              <span>Target: {typeof goal.target === "number" && goal.target > 100 ? goal.target.toLocaleString() : goal.target}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
