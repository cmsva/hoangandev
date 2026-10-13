import type { Metadata } from "next"
import { SettingsClient } from "./SettingsClient"

export const metadata: Metadata = {
  title: "Cài đặt chung | Admin Panel",
  description: "Cấu hình SEO, hình ảnh thương hiệu, màu chủ đạo và font chữ cho website.",
  robots: { index: false, follow: false },
}

export default function AdminSettingsPage() {
  return <SettingsClient />
}
