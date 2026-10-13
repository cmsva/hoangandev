import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"
import { connectDB } from "@/lib/db"
import { User, type IUser } from "@/models/user.model"
import { getSiteOption } from "@/models/setting.model"
import { generateToken } from "@/services/auth.service"
import { getSecurityConfig } from "@/lib/security-config"
import { escapeRegex } from "@/lib/sanitize"
import type { OAuthProvider } from "@/lib/oauth"
import type { OAuthUserInfo } from "@/lib/oauth/types"

const BCRYPT_ROUNDS = 12

export interface OAuthLoginResult {
  token: string
  ttlSeconds: number
  userId: string
  isNew: boolean
  banned: boolean
}

/** Sinh username unique từ tên/provider. */
async function generateUniqueUsername(base: string, provider: string): Promise<string> {
  const cleaned = base.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || `${provider}user`
  let username = cleaned
  let counter = 1
  // Giới hạn vòng lặp để tránh long-loop
  while (
    counter < 1000 &&
    (await User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, "i") } })
      .select("_id")
      .lean())
  ) {
    username = `${cleaned}${counter}`
    counter++
  }
  return username
}

/**
 * Tìm user theo provider id → theo email (link account) → tạo mới.
 * Trả token + meta. KHÔNG set cookie (việc của route).
 */
export async function findOrCreateOAuthUser(params: {
  provider: OAuthProvider
  userInfo: OAuthUserInfo
  ip: string | null
  device: string | null
}): Promise<OAuthLoginResult> {
  const { provider, userInfo, ip, device } = params
  await connectDB()

  const providerIdPath = `oauthIds.${provider}`

  // 1. Tìm theo provider id
  let user = (await User.findOne({ [providerIdPath]: userInfo.id })) as IUser | null

  // 2. Tìm theo email → link provider vào account hiện có
  if (!user && userInfo.email) {
    user = (await User.findOne({
      email: { $regex: new RegExp(`^${escapeRegex(userInfo.email)}$`, "i") },
    })) as IUser | null
    if (user) {
      user.set(providerIdPath, userInfo.id)
      if (!user.provider) user.provider = provider
      if (userInfo.avatar && !user.avatar) user.avatar = userInfo.avatar
      await user.save()
    }
  }

  let isNew = false

  // 3. Tạo mới
  if (!user) {
    isNew = true
    const username = await generateUniqueUsername(userInfo.name || `${provider}_user`, provider)
    const randomPass = randomBytes(32).toString("hex")
    const hashedPassword = await bcrypt.hash(randomPass, BCRYPT_ROUNDS)
    const email = userInfo.email
      ? userInfo.email.toLowerCase()
      : `${provider}_${userInfo.id}@oauth.local`

    // Snapshot affiliate rate như register thường
    const ckRefRaw = await getSiteOption("ck_ref")
    const refCkSnapshot = parseFloat(ckRefRaw || "0") || 0

    user = (await User.create({
      username,
      fullname: userInfo.name || username,
      email,
      password: hashedPassword,
      avatar: userInfo.avatar || null,
      provider,
      oauthIds: { [provider]: userInfo.id },
      // OAuth-provided email coi như đã verify (Google/GitHub/Discord)
      emailVerified: userInfo.email ? 1 : 0,
      secretKey2fa: randomBytes(20).toString("hex"),
      refCk: refCkSnapshot,
      ip,
      device,
    })) as IUser
  }

  if (user.banned === 1) {
    return { token: "", ttlSeconds: 0, userId: String(user._id), isNew, banned: true }
  }

  // Issue JWT tôn trọng session TTL
  const secCfg = await getSecurityConfig()
  const token = generateToken(String(user._id), user.admin || 0, secCfg.sessionTtl)

  await User.updateOne(
    { _id: user._id },
    { $set: { token, ip, device, timeSession: new Date().toISOString() } }
  )

  return { token, ttlSeconds: secCfg.sessionTtl, userId: String(user._id), isNew, banned: false }
}
