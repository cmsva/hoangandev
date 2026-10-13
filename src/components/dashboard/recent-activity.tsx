"use client"

import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { RecentActivitySkeleton } from "@/components/dashboard/dashboard-skeletons"

export function RecentActivity() {
  const trpc = useTRPC()
  const { data: activities, isLoading } = useQuery(trpc.dashboard.recentActivity.queryOptions()) as { data: any[] | undefined; isLoading: boolean }

  if (isLoading) return <RecentActivitySkeleton />

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 overflow-hidden">
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold truncate">Hoạt động gần đây</h3>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">Lịch sử đăng nhập và thao tác</p>
        </div>
        <a href="/customer/logs" className="text-xs font-medium text-primary hover:underline shrink-0">
          Xem tất cả →
        </a>
      </div>
      <div className="space-y-0">
        {activities && activities.length > 0 ? (
          activities.map((activity: any) => (
            <div key={activity.id} className="flex items-start gap-3 border-b border-border/50 py-3 last:border-0">
              {/* Icon */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 12h.01" /><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M22 13a18.15 18.15 0 0 1-20 0" /><rect width="20" height="14" x="2" y="6" rx="2" />
                </svg>
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground break-words">{activity.action}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="shrink-0">
                    {new Date(activity.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {activity.ip && (
                    <>
                      <span className="shrink-0">•</span>
                      <span className="truncate max-w-[160px]">{activity.ip}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Chưa có hoạt động nào
          </div>
        )}
      </div>
    </div>
  )
}
