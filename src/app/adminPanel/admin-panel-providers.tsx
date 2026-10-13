"use client"

import type { ComponentProps, ReactNode } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { AuthSessionProvider } from "@/components/auth-session-provider"
import { TRPCReactProvider } from "@/trpc/client"

export function AdminPanelProviders({
  children,
  session,
}: {
  children: ReactNode
  session: ComponentProps<typeof AuthSessionProvider>["session"]
}) {
  return (
    <TRPCReactProvider>
      <AuthSessionProvider session={session}>
        <AdminShell>{children}</AdminShell>
      </AuthSessionProvider>
    </TRPCReactProvider>
  )
}
