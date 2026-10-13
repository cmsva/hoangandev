/**
 * Client-side session provider.
 *
 * Nhận `session` từ Server Component (props), không refetch.
 * Tất cả client component muốn đọc user dùng `useSession()` thay vì
 * `useQuery(auth.me)` để tránh waterfall + flash content.
 */
"use client"

import { createContext, useContext } from "react"
import type { SessionUser } from "@/lib/session"

const SessionContext = createContext<SessionUser | null>(null)

export function AuthSessionProvider({
  session,
  children,
}: {
  session: SessionUser | null
  children: React.ReactNode
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

/**
 * Lấy session từ context.
 * - Trả về null nếu chưa login (page public).
 * - Trả về user object nếu đang trong layout authenticated.
 */
export function useSession(): SessionUser | null {
  return useContext(SessionContext)
}

/**
 * Lấy session bắt buộc — throw nếu không có.
 * Chỉ dùng trong các component bên trong layout `(authenticated)`.
 */
export function useRequiredSession(): SessionUser {
  const s = useContext(SessionContext)
  if (!s) {
    throw new Error("useRequiredSession() must be used inside AuthSessionProvider with valid session")
  }
  return s
}
