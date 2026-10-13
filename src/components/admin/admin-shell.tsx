"use client"

import { useEffect, useState, type ReactNode } from "react"
import { SidebarProvider, useSidebar } from "@/components/sidebar-context"
import { AdminSidebar } from "./admin-sidebar"
import { AdminHeader } from "./admin-header"

function AdminShellInner({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar()
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        <AdminHeader />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <div className="min-h-screen bg-background" suppressHydrationWarning />
  }

  return (
    <SidebarProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </SidebarProvider>
  )
}
