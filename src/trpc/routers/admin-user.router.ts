import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, adminProcedure } from "../init"
import { connectDB } from "@/lib/db"
import { mutationLimiter, consumeRateLimit, composeKey } from "@/lib/rate-limit"
import { insertLog } from "@/services/log.service"
import { zObjectId } from "@/lib/zod-schemas"
import {
  listAdminUsers,
  getUserStats,
  getAdminUserDetail,
  setUserBanned,
  setUserAdmin,
  reset2faUser,
  updateUserInfo,
  resetUserPassword,
  adjustUserBalance,
  deleteUser,
} from "@/services/admin-user.service"

const listInput = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    keyword: z.string().max(100).optional(),
    banned: z.number().int().min(0).max(1).optional(),
    admin: z.number().int().min(0).max(1).optional(),
    has2fa: z.boolean().optional(),
    sortField: z.enum(["createdAt", "money", "totalMoney", "username"]).default("createdAt"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()

const idInput = z.object({ id: zObjectId }).strict()

const updateInput = z
  .object({
    fullname: z.string().trim().max(200).nullable().optional(),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    refId: z.string().trim().max(100).nullable().optional(),
  })
  .strict()

const balanceInput = z
  .object({
    id: zObjectId,
    amount: z.number().int().min(-1_000_000_000).max(1_000_000_000),
    content: z.string().trim().min(1).max(500),
  })
  .strict()

const searchLiteInput = z
  .object({
    keyword: z.string().trim().min(1).max(100),
    limit: z.number().int().min(1).max(20).default(10),
  })
  .strict()

export const adminUserRouter = createTRPCRouter({
  list: adminProcedure.input(listInput).query(async ({ input }) => {
    await connectDB()
    return await listAdminUsers(input)
  }),

  /** Lightweight search for picker UIs — returns id+display only. */
  searchLite: adminProcedure.input(searchLiteInput).query(async ({ input }) => {
    await connectDB()
    const safe = input.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const { User } = await import("@/models/user.model")
    const docs = (await User.find({
      $or: [
        { username: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        { fullname: { $regex: safe, $options: "i" } },
      ],
      banned: { $ne: 1 },
    })
      .select("username email fullname avatar emailVerified telegramId")
      .sort({ createdAt: -1 })
      .limit(input.limit)
      .lean()) as any[]
    return docs.map((u) => ({
      id: String(u._id),
      username: u.username,
      email: u.email,
      fullname: u.fullname || null,
      avatar: u.avatar || null,
      emailVerified: u.emailVerified === 1,
      hasTelegram: !!u.telegramId,
    }))
  }),

  stats: adminProcedure.query(async () => {
    await connectDB()
    return await getUserStats()
  }),

  detail: adminProcedure.input(idInput).query(async ({ input }) => {
    await connectDB()
    return await getAdminUserDetail(input.id)
  }),

  setBanned: adminProcedure
    .input(z.object({ id: zObjectId, banned: z.number().int().min(0).max(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.user.ban", String(ctx.user._id)), "ban")
      // Self-protection: không cho admin tự ban mình
      if (String(ctx.user._id) === input.id && input.banned === 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể tự khóa tài khoản admin" })
      }
      await connectDB()
      await setUserBanned(input.id, input.banned)
      insertLog({
        userId: ctx.user._id,
        action: `${input.banned === 1 ? "Khóa" : "Mở khóa"} user (${input.id})`,
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true }
    }),

  setAdmin: adminProcedure
    .input(z.object({ id: zObjectId, admin: z.number().int().min(0).max(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.user.role", String(ctx.user._id)), "setAdmin")
      // Self-protection: không cho admin tự gỡ quyền mình
      if (String(ctx.user._id) === input.id && input.admin === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể tự gỡ quyền admin của chính mình" })
      }
      await connectDB()
      await setUserAdmin(input.id, input.admin)
      insertLog({
        userId: ctx.user._id,
        action: `${input.admin === 1 ? "Cấp" : "Gỡ"} quyền admin user (${input.id})`,
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true }
    }),

  reset2fa: adminProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.user.2fa", String(ctx.user._id)), "reset2fa")
      await connectDB()
      await reset2faUser(input.id)
      insertLog({
        userId: ctx.user._id,
        action: `Reset 2FA user (${input.id})`,
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true }
    }),

  updateInfo: adminProcedure
    .input(z.object({ id: zObjectId, data: updateInput }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.user.update", String(ctx.user._id)), "updateInfo")
      await connectDB()
      await updateUserInfo(input.id, input.data)
      insertLog({
        userId: ctx.user._id,
        action: `Cập nhật thông tin user (${input.id})`,
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true }
    }),

  resetPassword: adminProcedure
    .input(z.object({ id: zObjectId, password: z.string().min(6).max(100) }).strict())
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.user.pwd", String(ctx.user._id)), "resetPwd")
      await connectDB()
      await resetUserPassword(input.id, input.password)
      insertLog({
        userId: ctx.user._id,
        action: `Reset mật khẩu user (${input.id})`,
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true }
    }),

  adjustBalance: adminProcedure
    .input(balanceInput)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.user.balance", String(ctx.user._id)), "adjustBalance")
      await connectDB()
      const result = await adjustUserBalance({
        adminId: ctx.user._id,
        userId: input.id,
        amount: input.amount,
        content: input.content,
      })
      // Log đã được ghi trong service rồi (cả balance log + audit log)
      return result
    }),

  delete: adminProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      await consumeRateLimit(mutationLimiter, composeKey("admin.user.del", String(ctx.user._id)), "delUser")
      if (String(ctx.user._id) === input.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể tự xóa tài khoản" })
      }
      await connectDB()
      await deleteUser(input.id)
      insertLog({
        userId: ctx.user._id,
        action: `Xóa user (${input.id})`,
        ip: ctx.ip,
      }).catch(() => {})
      return { success: true }
    }),
})
