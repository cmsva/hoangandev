"use client"

/**
 * NotificationsPageClient — Tab wrapper cho trang Thông báo admin.
 *  - Tab 1: Gửi thông báo cho người dùng (broadcast).
 *  - Tab 2: Banner & Popup trang chủ (site notifications).
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminNotificationsClient } from "./AdminNotificationsClient"
import { SiteNotificationsConfig } from "./SiteNotificationsConfig"

export function NotificationsPageClient() {
  return (
    <Tabs defaultValue="broadcast" className="space-y-6">
      <TabsList>
        <TabsTrigger value="broadcast">Gửi cho người dùng</TabsTrigger>
        <TabsTrigger value="site">Banner & Popup trang chủ</TabsTrigger>
      </TabsList>

      <TabsContent value="broadcast">
        <AdminNotificationsClient />
      </TabsContent>

      <TabsContent value="site" className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Banner & Popup trang chủ</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Cấu hình banner thông báo và popup nổi hiển thị trên trang chủ.
          </p>
        </div>
        <SiteNotificationsConfig />
      </TabsContent>
    </Tabs>
  )
}
