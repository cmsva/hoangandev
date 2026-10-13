import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { LogBalance } from "@/models/log.model"
import { getSiteOptions, setSiteOptions } from "@/models/setting.model"
import { User } from "@/models/user.model"
import { WithdrawRef } from "@/models/withdraw-ref.model"

const COMMISSION_LOG_PREFIX = "[Hoa hồng]"
const MIN_WITHDRAW_DEFAULT = 1000
const MAX_WITHDRAW_DEFAULT = 10_000_000

export interface AdminAffiliateListParams {
  page: number
  limit: number
  keyword?: string
}

export interface AdminAffiliateWithdrawParams extends AdminAffiliateListParams {
  status?: number
}

export interface AdminAffiliateConfigInput {
  enabled: boolean
  rate: number
  minWithdraw: number
  maxWithdraw: number
  minDeposit: number
  maxDeposit: number
  balanceEnabled: boolean
  bankEnabled: boolean
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  return new Types.ObjectId(id)
}

function serializeDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  return value ? String(value) : null
}

function serializeUser(raw: any) {
  if (!raw) return null
  return {
    _id: raw._id?.toString?.() ?? String(raw._id ?? ""),
    username: raw.username ?? "",
    fullname: raw.fullname ?? null,
    email: raw.email ?? "",
  }
}

function serializeLog(raw: any) {
  return {
    _id: raw._id?.toString?.() ?? String(raw._id ?? ""),
    userId: raw.userId?.toString?.() ?? String(raw.userId ?? ""),
    moneyBefore: raw.moneyBefore ?? 0,
    moneyChange: raw.moneyChange ?? 0,
    moneyAfter: raw.moneyAfter ?? 0,
    content: raw.content ?? "",
    createdAt: serializeDate(raw.createdAt),
    user: serializeUser(raw.user),
  }
}
function serializeWithdraw(raw: any) {
  return {
    _id: raw._id?.toString?.() ?? String(raw._id ?? ""),
    userId: raw.userId?.toString?.() ?? String(raw.userId ?? ""),
    transId: raw.transId ?? "",
    bank: raw.bank ?? "",
    stk: raw.stk ?? "",
    name: raw.name ?? "",
    amount: raw.amount ?? 0,
    status: raw.status ?? 0,
    reason: raw.reason ?? null,
    createdAt: serializeDate(raw.createdAt),
    updatedAt: serializeDate(raw.updatedAt),
    user: serializeUser(raw.user),
  }
}

export async function getAdminAffiliateStats() {
  const [commissionAgg, withdrawAgg, usersAgg] = await Promise.all([
    LogBalance.aggregate([
      { $match: { content: { $regex: escapeRegex(COMMISSION_LOG_PREFIX), $options: "i" } } },
      { $group: { _id: null, totalCommission: { $sum: "$moneyChange" }, commissionCount: { $sum: 1 } } },
    ]),
    WithdrawRef.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ]),
    User.aggregate([
      {
        $group: {
          _id: null,
          totalClicks: { $sum: "$refClick" },
          totalRefUsers: { $sum: { $cond: [{ $ne: ["$refId", null] }, 1, 0] } },
        },
      },
    ]),
  ])

  const withdrawByStatus = new Map<number, { count: number; amount: number }>()
  for (const item of withdrawAgg) {
    withdrawByStatus.set(Number(item._id), { count: item.count ?? 0, amount: item.amount ?? 0 })
  }

  return {
    totalCommission: commissionAgg[0]?.totalCommission ?? 0,
    commissionCount: commissionAgg[0]?.commissionCount ?? 0,
    pendingWithdrawCount: withdrawByStatus.get(0)?.count ?? 0,
    pendingWithdrawAmount: withdrawByStatus.get(0)?.amount ?? 0,
    completedWithdrawAmount: withdrawByStatus.get(1)?.amount ?? 0,
    rejectedWithdrawAmount: withdrawByStatus.get(2)?.amount ?? 0,
    totalClicks: usersAgg[0]?.totalClicks ?? 0,
    totalRefUsers: usersAgg[0]?.totalRefUsers ?? 0,
  }
}

export async function listAdminAffiliateLogs(params: AdminAffiliateListParams) {
  const page = Math.max(1, params.page)
  const limit = Math.min(100, Math.max(1, params.limit))
  const skip = (page - 1) * limit
  const keyword = params.keyword?.trim()

  const match: Record<string, unknown> = {
    content: { $regex: escapeRegex(COMMISSION_LOG_PREFIX), $options: "i" },
  }

  if (keyword) {
    const safe = escapeRegex(keyword)
    match.$or = [
      { content: { $regex: safe, $options: "i" } },
      { "user.username": { $regex: safe, $options: "i" } },
      { "user.fullname": { $regex: safe, $options: "i" } },
      { "user.email": { $regex: safe, $options: "i" } },
    ]
  }
  const pipeline = [
    { $match: { content: { $regex: escapeRegex(COMMISSION_LOG_PREFIX), $options: "i" } } },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { username: 1, fullname: 1, email: 1 } }],
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ...(keyword ? [{ $match: match }] : []),
  ]

  const [items, totalAgg] = await Promise.all([
    LogBalance.aggregate([
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    LogBalance.aggregate([...pipeline, { $count: "total" }]),
  ])

  const total = totalAgg[0]?.total ?? 0
  return {
    items: items.map(serializeLog),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function listAdminAffiliateWithdraws(params: AdminAffiliateWithdrawParams) {
  const page = Math.max(1, params.page)
  const limit = Math.min(100, Math.max(1, params.limit))
  const skip = (page - 1) * limit
  const keyword = params.keyword?.trim()

  const baseMatch: Record<string, unknown> = {}
  if (params.status !== undefined) baseMatch.status = params.status

  const pipeline = [
    { $match: baseMatch },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        pipeline: [{ $project: { username: 1, fullname: 1, email: 1 } }],
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ...(keyword
      ? [
          {
            $match: {
              $or: [
                { transId: { $regex: escapeRegex(keyword), $options: "i" } },
                { bank: { $regex: escapeRegex(keyword), $options: "i" } },
                { stk: { $regex: escapeRegex(keyword), $options: "i" } },
                { name: { $regex: escapeRegex(keyword), $options: "i" } },
                { "user.username": { $regex: escapeRegex(keyword), $options: "i" } },
                { "user.fullname": { $regex: escapeRegex(keyword), $options: "i" } },
              ],
            },
          },
        ]
      : []),
  ]

  const [items, totalAgg] = await Promise.all([
    WithdrawRef.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    WithdrawRef.aggregate([...pipeline, { $count: "total" }]),
  ])

  const total = totalAgg[0]?.total ?? 0
  return {
    items: items.map(serializeWithdraw),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}
export async function updateAdminAffiliateWithdrawStatus(input: {
  id: string
  status: 1 | 2
  reason?: string
}) {
  const id = toObjectId(input.id)
  const current = await WithdrawRef.findOne({ _id: id, status: 0 }).lean<any>()
  if (!current) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Yêu cầu không còn chờ duyệt" })
  }

  const reason = input.status === 2 ? input.reason?.trim() || "Admin từ chối" : null
  const updated = await WithdrawRef.findOneAndUpdate(
    { _id: id, status: 0 },
    { $set: { status: input.status, reason } },
    { new: true }
  ).lean<any>()

  if (!updated) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Yêu cầu đã được xử lý" })
  }

  if (input.status === 2 && current.bank !== "BALANCE") {
    await User.updateOne({ _id: current.userId }, { $inc: { refMoney: current.amount } })
  }

  return {
    success: true,
    message: input.status === 1 ? "Đã duyệt yêu cầu rút" : "Đã từ chối và hoàn tiền",
    item: serializeWithdraw(updated),
  }
}

export async function getAdminAffiliateConfig() {
  const opts = await getSiteOptions([
    "status_ref",
    "ck_ref",
    "min_ruttien",
    "max_ruttien",
    "ref_min_deposit",
    "ref_max_deposit",
    "ref_withdraw_balance",
    "ref_withdraw_bank",
  ])

  return {
    enabled: (opts.status_ref || "1") === "1",
    rate: Number.parseFloat(opts.ck_ref || "0") || 0,
    minWithdraw: Number.parseInt(opts.min_ruttien || String(MIN_WITHDRAW_DEFAULT), 10),
    maxWithdraw: Number.parseInt(opts.max_ruttien || String(MAX_WITHDRAW_DEFAULT), 10),
    minDeposit: Number.parseInt(opts.ref_min_deposit || "0", 10),
    maxDeposit: Number.parseInt(opts.ref_max_deposit || "0", 10),
    balanceEnabled: (opts.ref_withdraw_balance || "1") === "1",
    bankEnabled: (opts.ref_withdraw_bank || "1") === "1",
  }
}

export async function updateAdminAffiliateConfig(input: AdminAffiliateConfigInput) {
  if (input.maxWithdraw > 0 && input.minWithdraw > input.maxWithdraw) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Min rút không được lớn hơn max" })
  }
  if (input.maxDeposit > 0 && input.minDeposit > input.maxDeposit) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Min nạp không được lớn hơn max" })
  }

  await setSiteOptions({
    status_ref: input.enabled ? "1" : "0",
    ck_ref: String(input.rate),
    min_ruttien: String(input.minWithdraw),
    max_ruttien: String(input.maxWithdraw),
    ref_min_deposit: String(input.minDeposit),
    ref_max_deposit: String(input.maxDeposit),
    ref_withdraw_balance: input.balanceEnabled ? "1" : "0",
    ref_withdraw_bank: input.bankEnabled ? "1" : "0",
  })

  return { success: true, message: "Đã lưu cấu hình affiliate" }
}
