/**
 * Sign / verify JWT 8h cho `/api/agency/get-token`.
 *
 * Pattern y theo xvps.vn:
 *  - HS256 với JWT_SECRET (đã có sẵn cho user-auth, dùng chung được)
 *  - TTL = 8h. Sau khi hết hạn → user gọi lại get-token.
 *  - Idempotent: nếu key có cachedToken còn hạn → trả lại token cũ
 *    (xem `getOrIssueToken` ở api-key.service)
 *
 * Payload chứa keyId + userId + scopes — đủ để authorize không cần DB lookup
 * trên hot path. Tuy nhiên handler vẫn phải verify key.status='active' (cache 60s).
 */
import jwt from "jsonwebtoken"
import type { Types } from "mongoose"

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters")
  }
  return secret
}

export const AGENCY_JWT_TTL_SEC = 8 * 60 * 60 // 8 giờ
export const AGENCY_JWT_AUDIENCE = "agency-api"

export interface AgencyJwtPayload {
  /** ApiKey._id */
  kid: string
  /** User._id */
  uid: string
  /** Subset of scopes copied from ApiKey */
  scopes: string[]
  /** Issue + expire epoch */
  iat?: number
  exp?: number
  aud?: string
}

export function signAgencyToken(input: {
  apiKeyId: Types.ObjectId | string
  userId: Types.ObjectId | string
  scopes: string[]
}): { token: string; expiresAt: Date; expiresIn: number } {
  const expiresIn = AGENCY_JWT_TTL_SEC
  const token = jwt.sign(
    {
      kid: String(input.apiKeyId),
      uid: String(input.userId),
      scopes: input.scopes,
    } satisfies Omit<AgencyJwtPayload, "iat" | "exp" | "aud">,
    getJwtSecret(),
    {
      algorithm: "HS256",
      audience: AGENCY_JWT_AUDIENCE,
      expiresIn,
    }
  )
  return {
    token,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  }
}

export function verifyAgencyToken(token: string): AgencyJwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      audience: AGENCY_JWT_AUDIENCE,
    }) as AgencyJwtPayload
  } catch {
    return null
  }
}
