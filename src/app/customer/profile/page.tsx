/**
 * Customer profile page (RSC).
 *
 * Pattern:
 * - Prefetch profile.get → client useQuery hit cache ngay khi mount
 * - SidebarProvider đã wrap ở customer/layout.tsx (sẽ thêm sau)
 */
import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { ProfileClient } from "./ProfileClient"

export const metadata = {
  title: "Hồ sơ cá nhân",
}

export default async function ProfilePage() {
  prefetch(trpc.profile.get.queryOptions())

  return (
    <HydrateClient>
      <ProfileClient />
    </HydrateClient>
  )
}
