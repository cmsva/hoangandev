/**
 * Admin user service — quản lý khách hàng.
 *
 * Operations: list (có search/filter), get detail, ban/unban, set admin,
 * adjust balance (cộng/trừ tiền nhanh), reset password, delete.
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { User, type IUser } from "@/models/user.model"
import { LogBalance, Log } from "@/models/log.model"
import { Order } from "@/models/order-product.model"
import { OrderDomain } from "@/models/domain.model"
import { Cronjob } from "@/models/cronjob.model"
import { LogoOrder } from "@/models/logo.model"
import { hashPassword, invalidateCurrentUser } from "@/services/auth.service"
import { escapeRegex } from "@/lib/sanitize"

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  return new Types.ObjectId(id)
}

// ═══ LIST ═══════════════════════════════════════════════════════════════════

export interface UserListInput {
  page: number
  limit: number
  keyword?: string
  banned?: number // 0 | 1
  admin?: number // 0 | 1
  has2fa?: boolean
  sortField?: "createdAt" | "money" | "totalMoney" | "username"
  sortDir?: "asc" | "desc"
}

export async function listAdminUsers(input: UserListInput) {
  const { page, limit, keyword, banned, admin, has2fa } = input
  const sortField = input.sortField ?? "createdAt"
  const sortDir = input.sortDir ?? "desc"
  const skip = (page - 1) * limit

  const filter: Record<string, any> = {}
  if (typeof banned === "number") filter.banned = banned
  if (typeof admin === "number") filter.admin = admin
  if (typeof has2fa === "boolean") {
    filter.status2fa = has2fa ? 1 : 0
  }
  if (keyword) {
    const re = new RegExp(escapeRegex(keyword.toLowerCase().trim()), "i")
    filter.$or = [{ username: re }, { email: re }, { fullname: re }]
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select(
        "username email fullname avatar admin banned money totalMoney rewardPoints status2fa refId ip lastSeen createdAt updatedAt"
      )
      .sort({ [sortField]: sortDir === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ])

  return {
    items: items.map((u: any) => ({
      id: String(u._id),
      username: u.username,
      email: u.email,
      fullname: u.fullname,
      avatar: u.avatar,
      admin: u.admin,
      banned: u.banned,
      money: u.money,
      totalMoney: u.totalMoney,
      rewardPoints: u.rewardPoints,
      status2fa: u.status2fa,
      refId: u.refId,
      ip: u.ip,
      lastSeen: u.lastSeen,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

// ═══ STATS ══════════════════════════════════════════════════════════════════

export async function getUserStats() {
  const now = Date.now()
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const onlineThreshold = new Date(now - 5 * 60_000) // 5 phút = online

  const [result] = await User.aggregate([
    {
      $facet: {
        totalAll: [{ $count: "n" }],
        totalActive: [{ $match: { banned: 0 } }, { $count: "n" }],
        totalBanned: [{ $match: { banned: 1 } }, { $count: "n" }],
        totalToday: [{ $match: { createdAt: { $gte: startToday } } }, { $count: "n" }],
        totalOnline: [
          { $match: { lastSeen: { $gte: onlineThreshold }, banned: 0 } },
          { $count: "n" },
        ],
        totalUser: [{ $match: { admin: 0 } }, { $count: "n" }],
        totalAdmin: [{ $match: { admin: 1 } }, { $count: "n" }],
        sums: [
          {
            $group: {
              _id: null,
              totalBalance: { $sum: "$money" },
              totalDeposit: { $sum: "$totalMoney" },
            },
          },
        ],
      },
    },
  ])

  const pickN = (arr: any[]) => arr?.[0]?.n ?? 0
  const sums = result?.sums?.[0] ?? { totalBalance: 0, totalDeposit: 0 }

  return {
    totalAll: pickN(result?.totalAll),
    totalActive: pickN(result?.totalActive),
    totalBanned: pickN(result?.totalBanned),
    totalToday: pickN(result?.totalToday),
    totalOnline: pickN(result?.totalOnline),
    totalUser: pickN(result?.totalUser),
    totalAdmin: pickN(result?.totalAdmin),
    totalBalance: sums.totalBalance ?? 0,
    totalSpent: Math.max(0, (sums.totalDeposit ?? 0) - (sums.totalBalance ?? 0)),
  }
}

// ═══ DETAIL ═════════════════════════════════════════════════════════════════

export async function getAdminUserDetail(id: string) {
  const _id = toObjectId(id)

  // Single roundtrip: user info + counters trên các bảng đơn
  const u = (await User.findById(_id)
    .select("-password -token -otp -secretKey2fa")
    .lean()) as any
  if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy user" })

  // Đếm orders parallel
  const [
    productOrders,
    domainOrders,
    cronjobOrders,
    logoOrders,
    referrals,
  ] = await Promise.all([
    Order.countDocuments({ userId: _id }),
    OrderDomain.countDocuments({ userId: _id }),
    Cronjob.countDocuments({ userId: _id }),
    LogoOrder.countDocuments({ userId: _id }),
    User.countDocuments({ refId: u.username }),
  ])

  return {
    id: String(u._id),
    username: u.username,
    email: u.email,
    fullname: u.fullname,
    avatar: u.avatar,
    admin: u.admin,
    banned: u.banned,
    money: u.money,
    totalMoney: u.totalMoney,
    rewardPoints: u.rewardPoints,
    status2fa: u.status2fa,
    refId: u.refId,
    refMoney: u.refMoney,
    refTotalMoney: u.refTotalMoney,
    refClick: u.refClick,
    refAmount: u.refAmount,
    refCk: u.refCk,
    ip: u.ip,
    device: u.device,
    lastSeen: u.lastSeen,
    timeSession: u.timeSession,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    stats: {
      productOrders,
      domainOrders,
      cronjobOrders,
      logoOrders,
      referrals,
      totalOrders: productOrders + domainOrders + cronjobOrders + logoOrders,
    },
  }
}

// ═══ MUTATIONS ══════════════════════════════════════════════════════════════

export async function setUserBanned(id: string, banned: number) {
  const _id = toObjectId(id)
  await User.updateOne({ _id }, { $set: { banned } })
  invalidateCurrentUser(id)
}

export async function setUserAdmin(id: string, admin: number) {
  const _id = toObjectId(id)
  await User.updateOne({ _id }, { $set: { admin } })
  invalidateCurrentUser(id)
}

export async function reset2faUser(id: string) {
  const _id = toObjectId(id)
  await User.updateOne(
    { _id },
    { $set: { status2fa: 0, secretKey2fa: null } }
  )
  invalidateCurrentUser(id)
}

export interface UpdateUserInput {
  fullname?: string | null
  email?: string
  refId?: string | null
}

export async function updateUserInfo(id: string, input: UpdateUserInput) {
  const _id = toObjectId(id)
  const update: Record<string, any> = {}
  if (input.fullname !== undefined) update.fullname = input.fullname || null
  if (typeof input.email === "string") {
    const email = input.email.toLowerCase().trim()
    if (email) {
      // Check unique email
      const dup = await User.findOne({ email, _id: { $ne: _id } })
        .select("_id")
        .lean()
      if (dup) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email đã được dùng" })
      }
      update.email = email
    }
  }
  if (input.refId !== undefined) update.refId = input.refId || null

  if (Object.keys(update).length === 0) return
  await User.updateOne({ _id }, { $set: update })
  invalidateCurrentUser(id)
}

export async function resetUserPassword(id: string, newPassword: string) {
  if (newPassword.length < 6) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mật khẩu tối thiểu 6 ký tự" })
  }
  const _id = toObjectId(id)
  const hashed = await hashPassword(newPassword)
  await User.updateOne(
    { _id },
    { $set: { password: hashed, token: null } } // Force logout
  )
  invalidateCurrentUser(id)
}

/**
 * Cộng tiền nhanh (admin manual). Atomic + log balance change.
 */
export async function adjustUserBalance(input: {
  adminId: string | Types.ObjectId
  userId: string
  amount: number // positive = cộng, negative = trừ
  content: string
}) {
  const { amount, content, userId, adminId } = input
  if (amount === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Số tiền phải khác 0" })
  }
  if (Math.abs(amount) > 1_000_000_000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Số tiền vượt giới hạn (1 tỷ)" })
  }

  const _id = toObjectId(userId)

  // Atomic update với guard: nếu trừ tiền thì user phải có đủ balance
  let updated: IUser | null
  if (amount >= 0) {
    updated = await User.findOneAndUpdate(
      { _id },
      {
        $inc: { money: amount, totalMoney: amount },
      },
      { new: true }
    )
  } else {
    // Trừ tiền: chỉ cho trừ khi đủ balance
    updated = await User.findOneAndUpdate(
      { _id, money: { $gte: Math.abs(amount) } },
      { $inc: { money: amount } },
      { new: true }
    )
    if (!updated) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Số dư không đủ để trừ",
      })
    }
  }
  if (!updated) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy user" })
  }

  const moneyAfter = updated.money
  const moneyBefore = moneyAfter - amount

  // Log balance change (best-effort)
  await LogBalance.create({
    userId: _id,
    moneyBefore,
    moneyChange: amount,
    moneyAfter,
    content: `[Admin] ${content}`,
  }).catch(() => {})

  // Audit log
  Log.create({
    userId: adminId,
    action: `${amount > 0 ? "Cộng" : "Trừ"} ${Math.abs(amount).toLocaleString("vi-VN")}đ cho user ${updated.username} - ${content}`,
  }).catch(() => {})

  invalidateCurrentUser(userId)
  return { moneyBefore, moneyAfter, moneyChange: amount }
}

export async function deleteUser(id: string) {
  const _id = toObjectId(id)
  const u = (await User.findById(_id).select("admin money").lean()) as any
  if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy user" })

  if (u.admin === 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Không thể xóa admin. Hãy gỡ quyền admin trước.",
    })
  }
  if (u.money > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `User còn ${u.money.toLocaleString("vi-VN")}đ trong ví. Hãy trừ hết tiền hoặc khóa tài khoản thay vì xóa.`,
    })
  }

  // Check còn đơn đang chạy không
  const [hasActiveCron, hasActiveDomain] = await Promise.all([
    Cronjob.countDocuments({ userId: _id, status: "active" }),
    OrderDomain.countDocuments({
      userId: _id,
      status: { $in: ["pending", "completed", "renew_pending", "suspended"] },
    }),
  ])
  if (hasActiveCron > 0 || hasActiveDomain > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `User còn ${hasActiveCron} cronjob đang chạy + ${hasActiveDomain} domain hoạt động. Hãy khóa tài khoản thay vì xóa.`,
    })
  }

  await User.deleteOne({ _id })
}
