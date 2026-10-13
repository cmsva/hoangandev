import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { randomBytes } from "node:crypto"
import { connectDB } from "@/lib/db"
import { User, type IUser } from "@/models/user.model"
import { getSiteOption } from "@/models/setting.model"
import { cached, invalidate } from "@/lib/cache"

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set and at least 32 characters. Check your .env file."
    )
  }
  return secret
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"
const BCRYPT_ROUNDS = 12

/** Hash password with bcrypt */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/** Compare password with hash */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Generate JWT token. Optional TTL (seconds) — fallback to env JWT_EXPIRES_IN (7d default). */
export function generateToken(userId: string, admin = 0, ttlSeconds?: number): string {
  const expiresIn: string | number =
    typeof ttlSeconds === "number" && ttlSeconds >= 60 ? ttlSeconds : (JWT_EXPIRES_IN as string)
  return jwt.sign({ sub: userId, admin }, getJwtSecret(), {
    expiresIn: expiresIn as any,
  })
}

/** Generate short-lived temp token for 2FA verification (5 min) */
export function generateTempToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: "2fa" }, getJwtSecret(), { expiresIn: "5m" })
}

/** Verify temp token — returns userId or null */
export function verifyTempToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { sub: string; purpose?: string }
    if (payload.purpose !== "2fa") return null
    return payload.sub
  } catch {
    return null
  }
}

/** Verify JWT token */
export function verifyToken(token: string): { sub: string; admin?: number } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { sub: string; admin?: number }
  } catch {
    return null
  }
}

/** Strip sensitive fields from user (object form) */
export function toPublicUser(user: IUser): Record<string, any> {
  const obj =
    typeof (user as any).toObject === "function"
      ? (user as any).toObject()
      : { ...(user as Record<string, any>) }
  delete obj.password
  delete obj.token
  delete obj.otp
  delete obj.secretKey2fa
  return obj
}

/** Strip sensitive fields from a lean (POJO) user */
function stripSensitive(user: Record<string, any>): Record<string, any> {
  const { password, token, otp, secretKey2fa, ...rest } = user
  return rest
}

/** Register a new user */
export async function registerUser(input: {
  username: string
  fullname: string
  password: string
  email: string
  refId?: string | null
}) {
  await connectDB()

  const username = input.username.toLowerCase()
  const email = input.email.toLowerCase()

  // Check existing username/email in 1 round-trip
  const existing = await User.findOne(
    { $or: [{ username }, { email }] },
    { username: 1, email: 1 }
  ).lean<{ username: string; email: string } | null>()

  if (existing) {
    if (existing.username === username) throw new Error("USERNAME_EXISTS")
    throw new Error("EMAIL_EXISTS")
  }

  const hashedPassword = await hashPassword(input.password)

  // Auto-generate 2FA secret key (hex 20 bytes = 40 chars)
  // User có thể bật 2FA sau ngay lập tức mà không cần regen
  const secretKey2fa = randomBytes(20).toString("hex")

  // Snapshot affiliate rate tại thời điểm đăng ký từ site option ck_ref.
  // Admin có thể override sau qua User.refCk để tăng hồng cho user VIP.
  const ckRefRaw = await getSiteOption("ck_ref")
  const refCkSnapshot = parseFloat(ckRefRaw || "0") || 0

  const newUser = await User.create({
    username,
    fullname: input.fullname,
    password: hashedPassword,
    email,
    refId: input.refId ?? null,
    refCk: refCkSnapshot,
    secretKey2fa,
    status2fa: 0,
  })

  return toPublicUser(newUser)
}

/** Login user by username or email */
export async function loginUser(identifier: string, password: string, ttlSeconds?: number) {
  await connectDB()

  const normalizedId = identifier.toLowerCase().trim()

  // Find by username or email
  const user = await User.findOne({
    $or: [{ username: normalizedId }, { email: normalizedId }],
  })

  if (!user) {
    throw new Error("INVALID_CREDENTIALS")
  }

  if (user.banned === 1) {
    throw new Error("ACCOUNT_BANNED")
  }

  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    throw new Error("INVALID_CREDENTIALS")
  }

  const token = generateToken(user._id.toString(), user.admin || 0, ttlSeconds)

  // Update token in DB (best effort — không block login nếu fail)
  await User.updateOne({ _id: user._id }, { $set: { token } })

  return { user: toPublicUser(user), token }
}

async function loadCurrentUserFromDB(userId: string): Promise<Record<string, any> | null> {
  await connectDB()
  const user = await User.findById(userId)
    .select("-password -token -otp -secretKey2fa")
    .lean<Record<string, any> | null>()
  if (!user) return null
  return stripSensitive(user)
}

/**
 * Get current user — Redis cache 5s. Mọi protected procedure dùng nên cần cache.
 * Tradeoff: ban/role-change có hiệu lực sau ≤5s, đủ ngắn cho UX.
 */
export async function getCurrentUser(userId: string) {
  if (!/^[a-f\d]{24}$/i.test(userId)) return null
  return await cached(`auth:user:${userId}`, 5, () => loadCurrentUserFromDB(userId))
}

/** Force reload user — gọi sau khi update profile/role/ban. */
export function invalidateCurrentUser(userId: string): void {
  void invalidate(`auth:user:${userId}`)
}

/** Logout — invalidate token in DB + clear cache. */
export async function logoutUser(userId: string) {
  await connectDB()
  await User.updateOne({ _id: userId }, { $set: { token: null } })
  invalidateCurrentUser(userId)
}
