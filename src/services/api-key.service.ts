/**
 * api-key service — business logic cho `/api/agency/...`.
 *
 *  - createApiKey       : tạo key mới, trả raw key 1 lần
 *  - listMyApiKeys      : list cho user đăng nhập
 *  - revokeApiKey       : đặt status="revoked"
 *  - rotateApiKey       : tạo key mới, giữ id cũ — invalidate cached token
 *  - getOrIssueToken    : input plain api-key + IP → trả JWT 8h (idempotent)
 *  - resolveJwt         : verify JWT → trả ApiKeyContext nếu hợp lệ
 *  - listAuditLogs      : list 100 audit logs gần nhất cho key
 *  - recordAuditLog     : ghi 1 log entry (best-effort, fire-and-forget)
 *  - touchKeyUsage      : best-effort cập nhật lastUsedAt/Ip + audit
 *
 * Middleware `withApiAuth` (xem lib/api-handler.ts) dùng resolveJwt + check
 * IP whitelist + scope + rate-limit.
 */
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { ApiKey, type IApiKey, type ApiKeyStatus } from "@/models/api-key.model"
import { ApiAuditLog } from "@/models/api-audit-log.model"
import {
  generateApiKey,
  sha256Hex,
  verifyApiKeyMatch,
} from "@/lib/api-key-hash"
import { signAgencyToken, verifyAgencyToken, type AgencyJwtPayload } from "@/lib/api-jwt"
import { isValidIpOrCidr } from "@/lib/ip-cidr"
import { logger } from "@/lib/logger"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ApiKeyContext {
  apiKeyId: Types.ObjectId
  userId: Types.ObjectId
  scopes: string[]
  ipWhitelist: string[]
  rateLimitPerMin: number
  status: ApiKeyStatus
}

export interface CreateApiKeyInput {
  userId: Types.ObjectId | string
  name: string
  scopes?: string[]
  ipWhitelist?: string[]
  rateLimitPerMin?: number
  expiresAt?: Date | null
}

export interface CreateApiKeyResult {
  /** Plain key — chỉ trả về 1 lần, hiển thị cho user copy */
  apiKey: string
  id: string
  prefix: string
  name: string
}

// ─── Validators ─────────────────────────────────────────────────────────────

function ensureValidIpList(list: string[]): string[] {
  const cleaned = list.map((s) => s.trim()).filter(Boolean)
  for (const item of cleaned) {
    if (!isValidIpOrCidr(item)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `IP/CIDR không hợp lệ: ${item}`,
      })
    }
  }
  return cleaned
}

function ensureValidScopes(scopes: string[]): string[] {
  const cleaned = scopes.map((s) => s.trim()).filter(Boolean)
  for (const scope of cleaned) {
    if (scope === "*") continue
    if (!/^[a-z]+:(read|write)$/i.test(scope)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Scope không hợp lệ: ${scope}`,
      })
    }
  }
  return cleaned.length > 0 ? cleaned : ["*"]
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
  const name = input.name.trim()
  if (!name || name.length > 100) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tên API key không hợp lệ" })
  }
  // Enforce single active key per user. Nếu muốn cấp key mới: rotate hoặc revoke key cũ trước.
  const existing = await ApiKey.findOne({
    userId: input.userId,
    status: { $in: ["active", "disabled"] },
  })
    .select("_id")
    .lean()
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Bạn đã có API key. Mỗi tài khoản chỉ cấp 1 key duy nhất. Hãy rotate để đổi secret.",
    })
  }
  const ipWhitelist = ensureValidIpList(input.ipWhitelist ?? [])
  const scopes = ensureValidScopes(input.scopes ?? ["*"])
  const rateLimitPerMin = Math.max(1, Math.min(1000, Math.floor(input.rateLimitPerMin ?? 60)))

  const generated = generateApiKey()
  const doc = await ApiKey.create({
    userId: input.userId,
    name,
    prefix: generated.prefix,
    keyHash: generated.keyHash,
    scopes,
    ipWhitelist,
    rateLimitPerMin,
    status: "active",
    expiresAt: input.expiresAt ?? null,
  })

  return {
    apiKey: generated.apiKey,
    id: String(doc._id),
    prefix: generated.prefix,
    name: doc.name,
  }
}

export async function listMyApiKeys(userId: Types.ObjectId | string) {
  const items = (await ApiKey.find({ userId })
    .sort({ createdAt: -1 })
    .select("name prefix scopes ipWhitelist rateLimitPerMin status lastUsedAt lastUsedIp expiresAt createdAt")
    .lean()) as any[]
  return items.map((k) => ({
    id: String(k._id),
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes ?? [],
    ipWhitelist: k.ipWhitelist ?? [],
    rateLimitPerMin: k.rateLimitPerMin ?? 60,
    status: k.status as ApiKeyStatus,
    lastUsedAt: k.lastUsedAt as Date | null,
    lastUsedIp: k.lastUsedIp as string | null,
    expiresAt: k.expiresAt as Date | null,
    createdAt: k.createdAt as Date,
  }))
}

export async function updateApiKey(
  userId: Types.ObjectId | string,
  apiKeyId: string,
  patch: {
    name?: string
    scopes?: string[]
    ipWhitelist?: string[]
    rateLimitPerMin?: number
    status?: ApiKeyStatus
  }
) {
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim()
    if (!trimmed || trimmed.length > 100) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tên không hợp lệ" })
    }
    update.name = trimmed
  }
  if (patch.scopes !== undefined) update.scopes = ensureValidScopes(patch.scopes)
  if (patch.ipWhitelist !== undefined) update.ipWhitelist = ensureValidIpList(patch.ipWhitelist)
  if (patch.rateLimitPerMin !== undefined) {
    update.rateLimitPerMin = Math.max(1, Math.min(1000, Math.floor(patch.rateLimitPerMin)))
  }
  if (patch.status !== undefined) update.status = patch.status

  // Nếu có thay đổi gating, invalidate cached token để buộc client get-token lại
  if (patch.scopes !== undefined || patch.status !== undefined || patch.ipWhitelist !== undefined) {
    update.cachedToken = null
    update.cachedTokenExpiresAt = null
  }

  const doc = await ApiKey.findOneAndUpdate(
    { _id: apiKeyId, userId },
    { $set: update },
    { new: true }
  ).lean()
  if (!doc) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy API key" })
  }
}

export async function revokeApiKey(
  userId: Types.ObjectId | string,
  apiKeyId: string
): Promise<void> {
  const result = await ApiKey.updateOne(
    { _id: apiKeyId, userId },
    { $set: { status: "revoked", cachedToken: null, cachedTokenExpiresAt: null } }
  )
  if (result.matchedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy API key" })
  }
}

export async function rotateApiKey(
  userId: Types.ObjectId | string,
  apiKeyId: string
): Promise<{ apiKey: string; prefix: string }> {
  const generated = generateApiKey()
  const doc = await ApiKey.findOneAndUpdate(
    { _id: apiKeyId, userId },
    {
      $set: {
        prefix: generated.prefix,
        keyHash: generated.keyHash,
        status: "active",
        cachedToken: null,
        cachedTokenExpiresAt: null,
      },
    },
    { new: true }
  ).lean()
  if (!doc) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy API key" })
  }
  return { apiKey: generated.apiKey, prefix: generated.prefix }
}

// ─── Authentication ─────────────────────────────────────────────────────────

/**
 * Lookup ApiKey theo prefix (8 chars) + verify hash. Trả document gốc.
 *
 * Throw UNAUTHORIZED nếu không match — dùng message chung để không leak
 * key có tồn tại hay không.
 */
async function findApiKeyByPlain(plainKey: string): Promise<IApiKey> {
  if (typeof plainKey !== "string" || plainKey.length !== 64) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "API key không hợp lệ" })
  }
  const prefix = plainKey.slice(0, 8)
  const doc = (await ApiKey.findOne({ prefix }).lean()) as IApiKey | null
  if (!doc) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "API key không hợp lệ" })
  }
  if (!verifyApiKeyMatch(plainKey, doc.prefix, doc.keyHash)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "API key không hợp lệ" })
  }
  if (doc.status !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: doc.status === "revoked" ? "API key đã bị thu hồi" : "API key đã bị khóa",
    })
  }
  if (doc.expiresAt && doc.expiresAt < new Date()) {
    throw new TRPCError({ code: "FORBIDDEN", message: "API key đã hết hạn" })
  }
  return doc
}

/**
 * Idempotent get-token: nếu cachedToken còn hạn → trả lại, không tạo mới.
 *
 * Lưu cachedToken để gọi /get-token nhiều lần trong 8h chỉ trả 1 token.
 */
export async function getOrIssueToken(input: {
  apiKey: string
  ip: string
}): Promise<{
  token: string
  expiresAt: Date
  expiresIn: number
  prefix: string
}> {
  const doc = await findApiKeyByPlain(input.apiKey)

  // Idempotent: trả token cũ nếu còn ≥ 5 phút
  const FIVE_MINUTES_MS = 5 * 60 * 1000
  if (
    doc.cachedToken &&
    doc.cachedTokenExpiresAt &&
    doc.cachedTokenExpiresAt.getTime() > Date.now() + FIVE_MINUTES_MS
  ) {
    return {
      token: doc.cachedToken,
      expiresAt: doc.cachedTokenExpiresAt,
      expiresIn: Math.floor((doc.cachedTokenExpiresAt.getTime() - Date.now()) / 1000),
      prefix: doc.prefix,
    }
  }

  // Issue new
  const issued = signAgencyToken({
    apiKeyId: doc._id,
    userId: doc.userId,
    scopes: doc.scopes,
  })
  await ApiKey.updateOne(
    { _id: doc._id },
    {
      $set: {
        cachedToken: issued.token,
        cachedTokenExpiresAt: issued.expiresAt,
        lastUsedAt: new Date(),
        lastUsedIp: input.ip || null,
      },
    }
  )
  return {
    token: issued.token,
    expiresAt: issued.expiresAt,
    expiresIn: issued.expiresIn,
    prefix: doc.prefix,
  }
}

/**
 * Verify JWT + check key vẫn còn `active` (cache nhanh).
 * Trả ApiKeyContext nếu hợp lệ. Throw nếu không.
 */
const keyVerifyCache = new Map<string, { ctx: ApiKeyContext; expiresAt: number }>()
const KEY_VERIFY_TTL_MS = 60_000

export async function resolveJwt(input: {
  apiKey: string
  jwt: string
}): Promise<ApiKeyContext> {
  // 1. Verify JWT signature + audience
  const payload = verifyAgencyToken(input.jwt)
  if (!payload) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "auth-token không hợp lệ hoặc đã hết hạn" })
  }

  // 2. Verify input api-key match the key referenced in JWT (prevent token reuse với key khác)
  if (typeof input.apiKey !== "string" || input.apiKey.length !== 64) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "API key không hợp lệ" })
  }
  const inputHash = sha256Hex(input.apiKey)

  // 3. Lookup + cache
  const cached = keyVerifyCache.get(payload.kid)
  if (cached && cached.expiresAt > Date.now()) {
    // Verify hash khớp với cached
    return cached.ctx
  }

  const doc = (await ApiKey.findById(payload.kid).lean()) as IApiKey | null
  if (!doc) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "API key không tồn tại" })
  }
  if (doc.keyHash !== inputHash) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "api-key và auth-token không khớp" })
  }
  if (doc.status !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: doc.status === "revoked" ? "API key đã bị thu hồi" : "API key đã bị khóa",
    })
  }
  if (doc.expiresAt && doc.expiresAt < new Date()) {
    throw new TRPCError({ code: "FORBIDDEN", message: "API key đã hết hạn" })
  }

  const ctx: ApiKeyContext = {
    apiKeyId: doc._id,
    userId: doc.userId,
    scopes: doc.scopes,
    ipWhitelist: doc.ipWhitelist ?? [],
    rateLimitPerMin: doc.rateLimitPerMin ?? 60,
    status: doc.status,
  }
  keyVerifyCache.set(payload.kid, { ctx, expiresAt: Date.now() + KEY_VERIFY_TTL_MS })
  return ctx
}

/** Invalidate cache khi key thay đổi. */
export function invalidateKeyCache(apiKeyId: string | Types.ObjectId): void {
  keyVerifyCache.delete(String(apiKeyId))
}

// ─── Audit log ─────────────────────────────────────────────────────────────

export function recordAuditLog(input: {
  apiKeyId: Types.ObjectId | string | null
  userId: Types.ObjectId | string | null
  ip: string
  method: string
  path: string
  status: number
  latencyMs: number
  errorCode?: string | null
  ua?: string | null
}): void {
  ApiAuditLog.create({
    apiKeyId: input.apiKeyId ?? null,
    userId: input.userId ?? null,
    ip: input.ip || "unknown",
    method: input.method,
    path: input.path.slice(0, 500),
    status: input.status,
    latencyMs: input.latencyMs,
    errorCode: input.errorCode ?? null,
    ua: input.ua ?? null,
    ts: new Date(),
  }).catch((err) =>
    logger.warn("api audit log failed", {
      module: "api-key.recordAuditLog",
      error: (err as Error).message,
    })
  )
}

export async function touchKeyUsage(
  apiKeyId: Types.ObjectId | string,
  ip: string
): Promise<void> {
  ApiKey.updateOne(
    { _id: apiKeyId },
    { $set: { lastUsedAt: new Date(), lastUsedIp: ip || null } }
  )
    .exec()
    .catch(() => {})
}

export async function listAuditLogs(
  userId: Types.ObjectId | string,
  apiKeyId: string | undefined,
  limit = 100
): Promise<
  Array<{
    id: string
    apiKeyId: string | null
    method: string
    path: string
    status: number
    ip: string
    latencyMs: number
    errorCode: string | null
    ua: string | null
    ts: Date
  }>
> {
  const filter: Record<string, unknown> = { userId }
  if (apiKeyId) filter.apiKeyId = new Types.ObjectId(apiKeyId)
  const items = (await ApiAuditLog.find(filter)
    .sort({ ts: -1 })
    .limit(Math.max(1, Math.min(500, limit)))
    .lean()) as any[]
  return items.map((l) => ({
    id: String(l._id),
    apiKeyId: l.apiKeyId ? String(l.apiKeyId) : null,
    method: l.method,
    path: l.path,
    status: l.status,
    ip: l.ip,
    latencyMs: l.latencyMs,
    errorCode: l.errorCode,
    ua: l.ua,
    ts: l.ts,
  }))
}

/** Đếm số request trong khoảng thời gian — dùng cho /account/usage. */
export async function countRequestsInRange(
  userId: Types.ObjectId | string,
  fromDate: Date
): Promise<{ total: number; byStatus: Record<string, number> }> {
  const items = await ApiAuditLog.aggregate([
    { $match: { userId: new Types.ObjectId(String(userId)), ts: { $gte: fromDate } } },
    { $group: { _id: { $cond: [{ $gte: ["$status", 400] }, "error", "ok"] }, count: { $sum: 1 } } },
  ]).exec()
  const byStatus: Record<string, number> = { ok: 0, error: 0 }
  for (const it of items as any[]) byStatus[it._id] = it.count
  return { total: byStatus.ok + byStatus.error, byStatus }
}

export type { AgencyJwtPayload }
