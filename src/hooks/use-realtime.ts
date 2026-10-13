"use client"

/**
 * use-realtime — cầu nối Socket.IO → React Query.
 *
 * Triết lý "ít bug nhất": khi nhận event realtime, invalidate các query đang
 * ACTIVE (React Query chỉ refetch query đang mounted). Không cần biết chính xác
 * queryKey của từng màn → không sợ gõ sai key, không phá logic. Tải sinh ra
 * đúng bằng (hoặc ít hơn) so với polling cũ, chỉ khác là trigger bằng event.
 *
 * - useRealtime(): mount 1 lần ở layout → tự invalidate khi có event.
 * - useSocketEvent(event, handler): cho component cần xử lý riêng (vd toast).
 */
import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useSocket } from "@/components/realtime/SocketProvider"

/** Các event server có thể đẩy xuống → cần làm mới dữ liệu. */
const INVALIDATING_EVENTS = [
  "balance:update",
  "deposit:success",
  "invoice:update",
  "order:update",
  "notification:new",
  "ticket:reply",
  "ticket:status",
  "admin:newOrder",
  "admin:newDeposit",
  "admin:newTicket",
] as const

/**
 * Mount ở layout vùng đã login. Nghe mọi event → debounce 250ms → invalidate
 * toàn bộ query active. Debounce gom nhiều event sát nhau thành 1 lần refetch.
 */
export function useRealtime(): void {
  const socket = useSocket()
  const queryClient = useQueryClient()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!socket) return

    const flush = () => {
      timerRef.current = null
      // Chỉ refetch query đang active (đang được component mount dùng).
      queryClient.invalidateQueries({ type: "active" })
    }

    const onAny = (...args: unknown[]) => {
      // #8 Nếu server emit kèm ACK (.timeout().emit(...)), arg cuối là callback.
      // Gọi ngay để xác nhận client đã nhận → server không báo ack timeout.
      const maybeAck = args[args.length - 1]
      if (typeof maybeAck === "function") {
        try {
          ;(maybeAck as (payload: unknown) => void)({ ok: true })
        } catch {
          /* ignore ack errors */
        }
      }
      if (timerRef.current) return
      timerRef.current = setTimeout(flush, 250)
    }

    for (const ev of INVALIDATING_EVENTS) socket.on(ev, onAny)

    return () => {
      for (const ev of INVALIDATING_EVENTS) socket.off(ev, onAny)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [socket, queryClient])
}

/**
 * Nghe 1 event cụ thể với handler riêng (vd hiện toast nạp tiền thành công,
 * join_ticket khi vào trang ticket). Tự cleanup khi unmount.
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (data: T) => void
): void {
  const socket = useSocket()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!socket) return
    const fn = (data: T) => handlerRef.current(data)
    socket.on(event, fn)
    return () => {
      socket.off(event, fn)
    }
  }, [socket, event])
}
