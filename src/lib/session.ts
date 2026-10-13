/**
 * Server-side session helper.
 *
 * Sử dụng `cache()` của React để dedupe trong 1 request — nhiều RSC
 * cùng gọi `getSession()` chỉ chạy 1 lần đọc cookie + DB.
 *
 * KHÔNG dùng ở Client Component. Truyền session qua props/Provider.
 */
import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifyToken, getCurrentUser } from "@/services/auth.service"

export type SessionUser = {
  _id: string
  username: string
  fullname: string | null
  avatar: string | null
  email: string
  admin: number
  banned: number
  money: number
  totalMoney: number
  rewardPoints: number
  refMoney: number
  refId: string | null
  status2fa: number
  createdAt: string | null
  updatedAt: string | null
  lastSeen: string | null
  [key: string]: any
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const c = await cookies()
  const token = c.get("token")?.value
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload?.sub) return null

  const user = await getCurrentUser(payload.sub)
  if (!user) return null

  // Defensive: nếu user bị banned thì không trả về session hợp lệ
  if (user.banned === 1) return null

  // Serialize cho boundary RSC -> Client: ObjectId -> string, Date -> ISO.
  return {
    ...user,
    _id: String(user._id),
    createdAt: serializeDate(user.createdAt),
    updatedAt: serializeDate(user.updatedAt),
    lastSeen: serializeDate(user.lastSeen),
  } as unknown as SessionUser
})

function serializeDate(v: any): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === "string") return v
  return null
}

/**
 * Bắt buộc có session, redirect về login nếu chưa auth.
 * Dùng trong layout của route group cần auth.
 */
export async function requireSession(redirectTo = "/authentication/login"): Promise<SessionUser> {
  const u = await getSession()
  if (!u) redirect(redirectTo)
  return u
}

/**
 * Bắt buộc admin role, redirect về dashboard nếu không phải admin.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireSession()
  if (u.admin !== 1) redirect("/dashboard")
  return u
}
