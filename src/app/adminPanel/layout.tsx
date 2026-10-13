import type { ReactNode } from "react"
import { AdminPanelProviders } from "./admin-panel-providers"
import { requireAdmin } from "@/lib/session"

export const metadata = {
  title: "Admin Panel",
}

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  // Server-side guard: yêu cầu admin role, redirect nếu không hợp lệ
  const session = await requireAdmin()

  return <AdminPanelProviders session={session}>{children}</AdminPanelProviders>
}
