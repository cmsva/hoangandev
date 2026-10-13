/**
 * ApiKey — agency credential cho REST API `/api/agency/...`.
 *
 * Pattern: user tạo key → backend trả về `apiKey` plain TEXT 1 lần (hex 64 chars).
 * Lưu DB:
 *   - `prefix` = 8 ký tự đầu (plain) → dùng để lookup nhanh
 *   - `keyHash` = SHA-256(apiKey) hex
 *
 * Verify khi user gửi request:
 *   1. Lấy 8 ký tự đầu → query Mongo theo `prefix` (indexed)
 *   2. So sánh sha256(input) với keyHash (constant-time)
 *
 * Khi user request token: server cache `keyId → keyDoc` 60s ở Redis (chưa cần)
 * → tra DB nhanh, không phải hash mỗi request.
 */
import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

export const API_KEY_STATUSES = ["active", "disabled", "revoked"] as const
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number]

export const API_KEY_SCOPES = [
  "websites:read",
  "websites:write",
  "domains:read",
  "domains:write",
  "cronjobs:read",
  "cronjobs:write",
  "logos:read",
  "logos:write",
  "products:read",
  "products:write",
  "deposits:read",
  "deposits:write",
  "account:read",
] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]

export interface IApiKey extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  /** Tên gợi nhớ user gắn cho key (vd "Production agency") */
  name: string
  /** 8 ký tự đầu của key (plain), indexed cho lookup nhanh */
  prefix: string
  /** SHA-256(fullKey), hex */
  keyHash: string
  /** Scope con — `*` = full access */
  scopes: string[]
  /** Danh sách IP/CIDR. Empty = allow all */
  ipWhitelist: string[]
  /** Limit req/phút. Default 60 */
  rateLimitPerMin: number
  status: ApiKeyStatus
  lastUsedAt: Date | null
  lastUsedIp: string | null
  /** Optional expiry. null = không expire */
  expiresAt: Date | null
  /** Cached JWT đang phát hành — idempotent get-token */
  cachedToken: string | null
  cachedTokenExpiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const apiKeySchema = new Schema<IApiKey>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    prefix: { type: String, required: true, trim: true, lowercase: true, maxlength: 16 },
    keyHash: { type: String, required: true, maxlength: 128 },
    scopes: { type: [String], default: ["*"] },
    ipWhitelist: { type: [String], default: [] },
    rateLimitPerMin: { type: Number, default: 60, min: 1, max: 1000 },
    status: { type: String, enum: API_KEY_STATUSES, default: "active", index: true },
    lastUsedAt: { type: Date, default: null },
    lastUsedIp: { type: String, default: null, maxlength: 64 },
    expiresAt: { type: Date, default: null },
    cachedToken: { type: String, default: null, maxlength: 2000 },
    cachedTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

// Lookup ưu tiên prefix
apiKeySchema.index({ prefix: 1, status: 1 })
apiKeySchema.index({ userId: 1, createdAt: -1 })
apiKeySchema.index({ status: 1, expiresAt: 1 })

export const ApiKey = registerModel<IApiKey>("ApiKey", apiKeySchema)
