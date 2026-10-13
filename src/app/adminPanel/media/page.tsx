import type { Metadata } from "next"
import { MediaClient } from "./MediaClient"

export const metadata: Metadata = {
  title: "Thư viện ảnh | Admin Panel",
  description: "Quản lý hình ảnh đã upload trong public/uploads.",
  robots: { index: false, follow: false },
}

export default function AdminMediaPage() {
  return <MediaClient />
}
