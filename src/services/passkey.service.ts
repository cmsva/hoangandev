/**
 * Passkey (WebAuthn) service — protocol-agnostic business logic.
 *
 * Ceremony challenge KHÔNG lưu Redis (fail-soft → có thể null). Thay vào đó router
 * lưu challenge trong cookie JWT ngắn hạn (5 phút) qua generateChallengeToken /
 * verifyChallengeToken. Service chỉ nhận `expectedChallenge` đã giải mã.
 *
 * RP config lấy từ NEXT_PUBLIC_APP_URL:
 *   - rpID  = hostname (vd "thegioidev.com" hoặc "localhost")
 *   - origin = protocol + host (kèm port nếu có)
 */
import jwt from "jsonwebtoken"
import { Types } from "mongoose"
import { TRPCError } from "@trpc/server"
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
} from "@simplewebauthn/server"
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server"
import { connectDB } from "@/lib/db"
import { Passkey, type IPasskey } from "@/models/passkey.model"
import { getCachedGeneralSettings } from "@/services/settings.service"

const JWT_SECRET = process.env.JWT_SECRET!

// ─── RP config (pure) ────────────────────────────────────────────────────────

export function getRpConfig(): { rpID: string; origin: string } {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
  const u = new URL(raw)
  return { rpID: u.hostname, origin: `${u.protocol}//${u.host}` }
}

// ─── Challenge token (pure JWT, 5 phút) ───────────────────────────────────────

type ChallengePurpose = "passkey-reg" | "passkey-auth"

export function generateChallengeToken(challenge: string, purpose: ChallengePurpose): string {
  return jwt.sign({ challenge, purpose }, JWT_SECRET, { expiresIn: "5m" })
}

export function verifyChallengeToken(
  token: string | undefined | null,
  purpose: ChallengePurpose
): string | null {
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { challenge?: string; purpose?: string }
    if (payload.purpose !== purpose || !payload.challenge) return null
    return payload.challenge
  } catch {
    return null
  }
}

// ─── Repository ────────────────────────────────────────────────────────────────

export async function listUserPasskeys(userId: Types.ObjectId | string) {
  await connectDB()
  const items = (await Passkey.find({ userId })
    .select("credentialId name deviceType backedUp transports lastUsedAt createdAt")
    .sort({ createdAt: -1 })
    .lean()) as unknown as IPasskey[]

  return items.map((p) => ({
    id: String(p._id),
    name: p.name,
    deviceType: p.deviceType,
    backedUp: p.backedUp,
    transports: p.transports,
    lastUsedAt: p.lastUsedAt,
    createdAt: p.createdAt,
  }))
}

async function findPasskeysByUser(userId: Types.ObjectId | string) {
  return (await Passkey.find({ userId })
    .select("credentialId transports")
    .lean()) as unknown as Pick<IPasskey, "credentialId" | "transports">[]
}

// ─── Registration ceremony ─────────────────────────────────────────────────────

export interface RegistrationOptionsResult {
  // PublicKeyCredentialCreationOptionsJSON
  options: Awaited<ReturnType<typeof generateRegistrationOptions>>
  challenge: string
}

export async function buildRegistrationOptions(
  userId: Types.ObjectId | string,
  username: string,
  displayName?: string | null
): Promise<RegistrationOptionsResult> {
  await connectDB()
  const { rpID } = getRpConfig()
  const site = await getCachedGeneralSettings()
  const rpName = site.siteTitle || "Tài khoản"

  const existing = await findPasskeysByUser(userId)

  const opts: GenerateRegistrationOptionsOpts = {
    rpName,
    rpID,
    userName: username,
    userDisplayName: displayName || username,
    // userID phải ổn định theo user để authenticator nhận diện cùng account.
    userID: new TextEncoder().encode(String(userId)),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credentialId,
      transports: p.transports as any,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  }

  const options = await generateRegistrationOptions(opts)
  return { options, challenge: options.challenge }
}

export async function verifyAndSaveRegistration(input: {
  userId: Types.ObjectId | string
  response: RegistrationResponseJSON
  expectedChallenge: string
  name: string
}): Promise<{ id: string; name: string }> {
  await connectDB()
  const { rpID, origin } = getRpConfig()

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: input.expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    })
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Xác minh Passkey thất bại" })
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể xác minh Passkey" })
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo

  // Tránh trùng credential (đã đăng ký ở account khác)
  const dup = await Passkey.findOne({ credentialId: credential.id }).select("_id").lean()
  if (dup) {
    throw new TRPCError({ code: "CONFLICT", message: "Passkey này đã được đăng ký" })
  }

  const doc = await Passkey.create({
    userId: input.userId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: credential.transports || [],
    name: input.name.trim().slice(0, 64) || "Passkey",
    lastUsedAt: new Date(),
  })

  return { id: String(doc._id), name: doc.name }
}

// ─── Authentication ceremony ────────────────────────────────────────────────────

/**
 * Chuẩn hóa publicKey đọc từ Mongo về Uint8Array.
 * `.lean()` có thể trả: Node Buffer, mongodb Binary, hoặc {type:'Buffer',data:[]}.
 * Nếu không chuẩn hóa, `new Uint8Array(binary)` ra byte rác → verify luôn fail.
 */
function toUint8Array(val: unknown): Uint8Array {
  if (val instanceof Uint8Array) return new Uint8Array(val) // Buffer cũng là Uint8Array
  const v = val as any
  if (v && typeof v === "object") {
    // mongodb Binary (modern): .buffer là Buffer/Uint8Array
    if (v.buffer instanceof Uint8Array) return new Uint8Array(v.buffer)
    // mongodb Binary (older): .value(true) trả Buffer
    if (typeof v.value === "function") {
      const b = v.value(true)
      if (b instanceof Uint8Array) return new Uint8Array(b)
    }
    // serialized {type:'Buffer', data:[...]}
    if (Array.isArray(v.data)) return new Uint8Array(v.data)
  }
  return new Uint8Array(0)
}

export async function buildAuthenticationOptions(): Promise<{
  options: Awaited<ReturnType<typeof generateAuthenticationOptions>>
  challenge: string
}> {
  const { rpID } = getRpConfig()
  // allowCredentials rỗng → discoverable credentials (browser tự match).
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: [],
  })
  return { options, challenge: options.challenge }
}

/**
 * Verify assertion → trả userId của passkey owner. Cập nhật counter + lastUsedAt.
 */
export async function verifyAuthentication(input: {
  response: AuthenticationResponseJSON
  expectedChallenge: string
}): Promise<{ userId: string }> {
  await connectDB()
  const { rpID, origin } = getRpConfig()

  // response.id = credentialId (base64url)
  const passkey = (await Passkey.findOne({ credentialId: input.response.id })
    .select("userId credentialId publicKey counter transports")
    .lean()) as unknown as IPasskey | null

  if (!passkey) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Passkey không tồn tại" })
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: input.expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: passkey.credentialId,
        publicKey: toUint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as any,
      },
    })
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Xác thực Passkey thất bại" })
  }

  if (!verification.verified) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Xác thực Passkey thất bại" })
  }

  // Cập nhật counter (anti-clone) + lastUsedAt — best-effort
  Passkey.updateOne(
    { _id: passkey._id },
    {
      $set: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    }
  ).catch(() => { })

  return { userId: String(passkey.userId) }
}

// ─── Management ─────────────────────────────────────────────────────────────────

export async function renamePasskey(
  userId: Types.ObjectId | string,
  passkeyId: string,
  name: string
): Promise<void> {
  await connectDB()
  const res = await Passkey.updateOne(
    { _id: passkeyId, userId },
    { $set: { name: name.trim().slice(0, 64) || "Passkey" } }
  )
  if (res.matchedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy Passkey" })
  }
}

export async function deletePasskey(
  userId: Types.ObjectId | string,
  passkeyId: string
): Promise<void> {
  await connectDB()
  const res = await Passkey.deleteOne({ _id: passkeyId, userId })
  if (res.deletedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy Passkey" })
  }
}
