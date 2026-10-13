import { HydrateClient, prefetch, trpc } from "@/trpc/server"
import { ExtensionsClient } from "./ExtensionsClient"

export const metadata = {
  title: "Tiện ích mở rộng | Admin Panel",
  description: "Quản lý OAuth login, captcha, mail SMTP, Telegram bot và template thông báo.",
  robots: { index: false, follow: false },
}

export default async function AdminExtensionsPage() {
  prefetch(trpc.adminExtensions.getOAuthConfig.queryOptions())
  return (
    <HydrateClient>
      <ExtensionsClient />
    </HydrateClient>
  )
}
