import type { Metadata } from "next"
import { SystemStatusClient } from "./SystemStatusClient"

export const metadata: Metadata = {
  title: "Trạng thái hệ thống | Admin Panel",
  description: "Giám sát realtime CPU, RAM, ổ đĩa và thời gian hoạt động của server.",
  robots: { index: false, follow: false },
}

export default function AdminSystemStatusPage() {
  return <SystemStatusClient />
}
