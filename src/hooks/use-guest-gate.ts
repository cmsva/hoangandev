/**
 * useGuestGate — chặn hành động cần đăng nhập (mua/thuê/tải) cho guest.
 *
 * Dùng ở các trang guest-viewable (mã nguồn, website, logo, cronjob...).
 * Guest XEM được nội dung nhưng khi bấm mua → redirect sang login kèm callbackUrl
 * để quay lại đúng trang sau khi đăng nhập.
 *
 * Backend vẫn là source of truth (mutation = protectedProcedure); hook này chỉ
 * cải thiện UX để tránh 401 khó hiểu.
 */
"use client"

import { useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "@/components/auth-session-provider"
import { toast } from "@/components/ui/toast"

export function useGuestGate() {
  const user = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const isGuest = !user

  /**
   * Bọc 1 hành động cần đăng nhập.
   *  - Guest: toast + redirect /authentication/login?callbackUrl=<current>, trả false.
   *  - Logged in: chạy `action()`, trả về kết quả của action (hoặc true).
   */
  const requireAuth = useCallback(
    <T,>(action: () => T): T | false => {
      if (!user) {
        toast.error("Vui lòng đăng nhập để tiếp tục")
        const callbackUrl = encodeURIComponent(pathname || "/")
        router.push(`/authentication/login?callbackUrl=${callbackUrl}`)
        return false
      }
      return action()
    },
    [user, router, pathname]
  )

  return { isGuest, requireAuth }
}
