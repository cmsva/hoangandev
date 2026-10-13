"use client"

/**
 * RealtimeBridge — component rỗng, chỉ chạy hook useRealtime.
 *
 * Phải nằm BÊN TRONG cả QueryClientProvider (useQueryClient) lẫn SocketProvider
 * (useSocket) → tách riêng thành component con để thỏa mãn cả 2 context.
 */
import { useRealtime } from "@/hooks/use-realtime"

export function RealtimeBridge() {
  useRealtime()
  return null
}
