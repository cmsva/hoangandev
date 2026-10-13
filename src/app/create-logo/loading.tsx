import { Skeleton } from "@/components/ui/skeleton"

/**
 * Dashboard loading skeleton — shows sidebar placeholder + main content skeleton.
 * Matches the dashboard layout structure for zero layout shift.
 */
export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar placeholder */}
      <div className="hidden lg:block w-[260px] border-r bg-card/50 p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b flex items-center px-4 gap-3">
          <Skeleton className="size-8 rounded-lg lg:hidden" />
          <Skeleton className="h-5 w-40" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>

        {/* Content area */}
        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>

          {/* Table area */}
          <Skeleton className="h-64 rounded-xl" />
        </main>
      </div>
    </div>
  )
}
