import { TRPCReactProvider } from "@/trpc/client"
import { AuthSessionProvider } from "@/components/auth-session-provider"
import { SidebarProvider } from "@/components/sidebar-context"
import { requireSession } from "@/lib/session"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()

  return (
    <TRPCReactProvider>
      <AuthSessionProvider session={session}>
        <SidebarProvider>{children}</SidebarProvider>
      </AuthSessionProvider>
    </TRPCReactProvider>
  )
}
