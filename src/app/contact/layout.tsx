import { TRPCReactProvider } from "@/trpc/client"
import { AuthSessionProvider } from "@/components/auth-session-provider"
import { SidebarProvider } from "@/components/sidebar-context"
import { getSession } from "@/lib/session"

export default async function ContactLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  return (
    <TRPCReactProvider>
      <AuthSessionProvider session={session}>
        <SidebarProvider>{children}</SidebarProvider>
      </AuthSessionProvider>
    </TRPCReactProvider>
  )
}
