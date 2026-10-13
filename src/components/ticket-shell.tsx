"use client"

import { useEffect, useState, type ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useSidebar } from "@/components/sidebar-context"

export function TicketShell({ children }: { children: ReactNode }) {
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
      <div className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"}`}>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
