"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { AppSidebar } from "@/components/app-sidebar"
import { useSidebar } from "@/components/sidebar-context"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { RecentOrders } from "@/components/dashboard/recent-orders"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { QuickAccess } from "@/components/dashboard/quick-access"
import { DashboardBanners } from "@/components/notifications/dashboard-banners"
import { FloatingPopup } from "@/components/notifications/floating-popup"
import {
  StatCardsSkeleton,
  BalanceChartSkeleton,
} from "@/components/dashboard/dashboard-skeletons"
import { StatCard } from "@/components/dashboard/stat-card"

const BalanceChart = dynamic(
  () => import("@/components/dashboard/balance-chart").then((m) => ({ default: m.BalanceChart })),
  { ssr: false, loading: () => <BalanceChartSkeleton /> }
)

interface DashboardShellProps {
  greeting: string
  userName: string
}

export function DashboardShell({ greeting, userName }: DashboardShellProps) {
  const { collapsed } = useSidebar()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <div className="flex min-h-screen bg-background" suppressHydrationWarning />
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        <DashboardHeader />
        <main className="flex-1 space-y-6 p-6">
          <DashboardWelcome greeting={greeting} userName={userName} />
          <DashboardNotifications />
          <DashboardStats />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <BalanceChart />
            </div>
            <div className="flex flex-col gap-4">
              <QuickAccess />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <RecentOrders />
            <RecentActivity />
          </div>
        </main>
      </div>
    </div>
  )
}

/**
 * Banner stack + popup dialog. Query 1 lần, cả 2 component dùng chung data.
 * `staleTime: 30s` vì banner không đổi thường xuyên và server có cache Redis 10s.
 */
function DashboardNotifications() {
  const trpc = useTRPC()
  const { data } = useQuery({
    ...trpc.public.siteNotifications.queryOptions(),
    staleTime: 30_000,
  }) as { data: any }

  if (!data) return null
  return (
    <>
      <DashboardBanners enabled={data.bannersEnabled} banners={data.banners || []} />
      <FloatingPopup config={data.popup} />
    </>
  )
}

function DashboardWelcome({ greeting, userName }: { greeting: string; userName: string }) {
  return (
    <div>
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
        <a href="/dashboard" className="hover:text-foreground transition-colors">
          Trang chủ
        </a>
        <span>/</span>
        <span className="text-foreground font-medium">Dashboard</span>
      </nav>
      <h1 className="text-xl font-bold text-foreground">
        {greeting}, {userName} 👋
      </h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        Quản lý và triển khai các dự án website của bạn.
      </p>
    </div>
  )
}

function DashboardStats() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.dashboard.stats.queryOptions()) as {
    data: any
    isLoading: boolean
  }

  if (isLoading) return <StatCardsSkeleton />

  const stats = [
    {
      title: "Số dư khả dụng",
      value: data ? `${data.balance.toLocaleString()}đ` : "0đ",
      trend: "",
      trendUp: true,
      sparkData: [20, 25, 22, 30, 28, 35, 32, 40, 38, 45, 42, 48],
      iconBg: "bg-sidebar-primary/10 text-sidebar-primary",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      title: "Tổng nạp",
      value: data ? `${data.totalDeposit.toLocaleString()}đ` : "0đ",
      trend: "",
      trendUp: true,
      sparkData: [15, 18, 20, 22, 19, 25, 28, 30, 27, 32, 35, 38],
      iconBg: "bg-[oklch(0.55_0.15_200)]/10 text-[oklch(0.55_0.15_200)]",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
    },
    {
      title: "Website hoạt động",
      value: data ? `${data.activeWebsites}` : "0",
      trend: "",
      trendUp: true,
      sparkData: [30, 28, 32, 25, 27, 22, 24, 20, 23, 18, 21, 19],
      iconBg: "bg-[oklch(0.70_0.12_85)]/10 text-[oklch(0.70_0.12_85)]",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      ),
    },
    {
      title: "Sắp hết hạn",
      value: data ? `${data.expiringSoon}` : "0",
      trend: data?.expiringSoon > 0 ? "Cần gia hạn" : "",
      trendUp: false,
      sparkData: [10, 15, 12, 20, 18, 25, 22, 30, 28, 35, 40, 45],
      iconBg: "bg-[oklch(0.60_0.20_300)]/10 text-[oklch(0.60_0.20_300)]",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  )
}
