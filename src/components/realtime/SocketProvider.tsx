"use client"

/**
 * SocketProvider — 1 connection Socket.IO duy nhất cho vùng đã login.
 *
 * Thiết kế (revise):
 *  - #6 Namespace tách: `/adminPanel/*` → ns `/admin`, còn lại → ns `/customer`.
 *  - #1 Server tự join room sau khi verify JWT → client KHÔNG emit join_user.
 *  - Chỉ kết nối khi có cookie `token` (khách vãng lai không mở websocket).
 *  - withCredentials: gửi cookie `token` để server verify JWT (zero-DB).
 *
 * Fail-soft: socket rớt → React Query poll fallback (#9) vẫn chạy. Không phá UI.
 */
import { createContext, useContext, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { io, type Socket } from "socket.io-client"

const SocketContext = createContext<Socket | null>(null)

export function useSocket(): Socket | null {
  return useContext(SocketContext)
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const pathname = usePathname()
  // #6 Chọn namespace theo khu vực. Đổi vùng (admin ↔ customer) → reconnect ns mới.
  const namespace = pathname?.startsWith("/adminPanel") ? "/admin" : "/customer"

  useEffect(() => {
    // Chỉ kết nối khi đã đăng nhập. Cookie `token` là httpOnly (JS KHÔNG đọc được),
    // nên check cookie hint `auth=1` (non-httpOnly) do middleware set song song.
    // Token thật vẫn tự gửi kèm handshake qua withCredentials để server verify JWT.
    if (typeof document === "undefined" || !/(?:^|;\s*)auth=1(?:;|$)/.test(document.cookie)) {
      return
    }

    // Same-origin, namespace-scoped. path khớp server (src/socket/io.ts).
    const s = io(namespace, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
    })

    setSocket(s)

    return () => {
      s.disconnect()
      setSocket(null)
    }
  }, [namespace])

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}
