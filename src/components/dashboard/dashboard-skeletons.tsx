

import { Skeleton } from "@/components/ui/skeleton"

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-[48px] w-full rounded-md" />
    </div>
  )
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  )
}

export function BalanceChartSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-9 w-[130px] rounded-md" />
      </div>
      <Skeleton className="h-[260px] w-full rounded-md" />
      <div className="mt-4 flex gap-4">
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
    </div>
  )
}

export function QuickAccessSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Skeleton className="h-4 w-24 mb-3" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 p-2.5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function RecentOrdersSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <Skeleton className="h-4 w-[40%]" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function RecentActivitySkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-[70%]" />
              <Skeleton className="h-3 w-[40%]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
