/**
 * Dashboard page (RSC).
 *
 * Server-side:
 * - Resolve session (đã có sẵn trong layout, lấy lại không tốn thêm DB do `cache()`)
 * - Prefetch dashboard.stats vào QueryClient → hydrate → client component không flash skeleton
 *
 * Client:
 * - DashboardClient cho phần interactive (sidebar layout + stat cards animate + chart)
 * - Welcome render trực tiếp từ session ở RSC → không có flash "Xin chào bạn"
 */
import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { getSession } from "@/lib/session"
import { DashboardShell } from "./DashboardShell"

export const metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  // Layout đã guard requireSession nên user chắc chắn có
  const session = await getSession()

  // Prefetch stats cho client useQuery hit cache ngay
  prefetch(trpc.dashboard.stats.queryOptions())

  // Tính greeting server-side cho mượt
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối"

  return (
    <HydrateClient>
      <DashboardShell
        greeting={greeting}
        userName={session?.fullname || session?.username || "bạn"}
      />
    </HydrateClient>
  )
}
