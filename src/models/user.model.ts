import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

export interface IUser extends Document {
  username: string
  fullname: string | null
  avatar: string | null
  password: string
  email: string
  admin: number
  token: string | null
  ip: string | null
  device: string | null
  otp: string | null
  money: number
  totalMoney: number
  rewardPoints: number
  rewardPointsTotalEarned: number
  rewardPointsTotalRedeemed: number
  banned: number
  status2fa: number
  secretKey2fa: string | null
  refId: string | null
  refMoney: number
  refTotalMoney: number
  refClick: number
  refAmount: number
  refCk: number
  emailVerified: number
  telegramId: string | null
  telegramUsername: string | null
  telegramLinkedAt: Date | null
  provider: string | null
  oauthIds: {
    google?: string
    github?: string
    discord?: string
    zalo?: string
    telegram?: string
  }
  resetToken: string | null
  resetTokenExpires: Date | null
  timeSession: string | null
  lastSeen: Date | null
  createdAt: Date
  updatedAt: Date
}

export type UserPublic = Omit<IUser, "password" | "token" | "otp" | "secretKey2fa"> & { _id: string }

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    fullname: { type: String, default: null },
    avatar: { type: String, default: null },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    admin: { type: Number, default: 0 },
    token: { type: String, default: null },
    ip: { type: String, default: null },
    device: { type: String, default: null },
    otp: { type: String, default: null },
    money: { type: Number, default: 0 },
    totalMoney: { type: Number, default: 0 },
    rewardPoints: { type: Number, default: 0 },
    rewardPointsTotalEarned: { type: Number, default: 0 },
    rewardPointsTotalRedeemed: { type: Number, default: 0 },
    banned: { type: Number, default: 0 },
    status2fa: { type: Number, default: 0 },
    secretKey2fa: { type: String, default: null },
    refId: { type: String, default: null },
    refMoney: { type: Number, default: 0 },
    refTotalMoney: { type: Number, default: 0 },
    refClick: { type: Number, default: 0 },
    refAmount: { type: Number, default: 0 },
    refCk: { type: Number, default: 0 },
    emailVerified: { type: Number, default: 0 },
    telegramId: { type: String, default: null, index: true },
    telegramUsername: { type: String, default: null },
    telegramLinkedAt: { type: Date, default: null },
    provider: { type: String, default: null },
    oauthIds: {
      google: { type: String, default: undefined },
      github: { type: String, default: undefined },
      discord: { type: String, default: undefined },
      zalo: { type: String, default: undefined },
      telegram: { type: String, default: undefined },
    },
    resetToken: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
    timeSession: { type: String, default: null },
    lastSeen: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

// Indexes
userSchema.index({ createdAt: -1 })
userSchema.index({ refId: 1 }) // Fast memberCount aggregation
userSchema.index({ lastSeen: -1 }) // Online users counter
// OAuth — sparse so chỉ index user đã liên kết provider tương ứng
userSchema.index({ "oauthIds.google": 1 }, { sparse: true })
userSchema.index({ "oauthIds.github": 1 }, { sparse: true })
userSchema.index({ "oauthIds.discord": 1 }, { sparse: true })
userSchema.index({ "oauthIds.zalo": 1 }, { sparse: true })
userSchema.index({ "oauthIds.telegram": 1 }, { sparse: true })
// Password reset — sparse lookup by token
userSchema.index({ resetToken: 1 }, { sparse: true })

export const User = registerModel<IUser>("User", userSchema)
