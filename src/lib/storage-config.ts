/**
 * Storage Config — đọc cấu hình lưu trữ ảnh từ DB, cache Redis 5s với invalidate.
 *
 * Provider:
 *  - local: ghi vào public/uploads/ (mặc định, hành vi cũ).
 *  - s3:    Amazon S3 (PutObject qua @aws-sdk/client-s3).
 *  - r2:    Cloudflare R2 (S3-compatible, endpoint riêng, region="auto").
 *
 * Credential (accessKey/secretKey) lưu DB đã mã hóa AES-256-GCM. Config này
 * decrypt khi load để service dùng. KHÔNG bao giờ trả raw credential cho UI.
 *
 * Fail-soft: DB lỗi → fallback DEFAULTS (local), không block upload.
 */
import { connectDB } from "@/lib/db"
import { getSiteOptions } from "@/models/setting.model"
import { cached, invalidate } from "@/lib/cache"
import { decryptValue } from "@/lib/encryption"

export type StorageProvider = "local" | "s3" | "r2"

export interface StorageConfig {
  provider: StorageProvider
  /** Giới hạn upload tính bằng bytes (đã quy đổi từ MB). */
  maxBytes: number
  /** S3/R2 bucket name. */
  bucket: string
  /** S3 region (vd "ap-southeast-1"). R2 luôn "auto". */
  region: string
  /** R2 endpoint: https://<account_id>.r2.cloudflarestorage.com. S3 để trống. */
  endpoint: string
  /** Base URL công khai để build URL ảnh: `<publicBaseUrl>/<key>`. */
  publicBaseUrl: string
  /** Credential đã decrypt — chỉ tồn tại server-side, không expose ra UI. */
  accessKey: string
  secretKey: string
}

const DEFAULT_MAX_MB = 5

const DEFAULTS: StorageConfig = {
  provider: "local",
  maxBytes: DEFAULT_MAX_MB * 1024 * 1024,
  bucket: "",
  region: "",
  endpoint: "",
  publicBaseUrl: "",
  accessKey: "",
  secretKey: "",
}

const KEYS = [
  "storage_provider",
  "storage_max_mb",
  "storage_bucket",
  "storage_region",
  "storage_endpoint",
  "storage_public_base_url",
  "storage_access_key", // encrypted
  "storage_secret_key", // encrypted
]

/** Clamp MB về [1, 50] để tránh giá trị vô lý hoặc OOM. */
export function clampMaxMb(mb: number): number {
  if (!Number.isFinite(mb) || mb < 1) return 1
  if (mb > 50) return 50
  return Math.floor(mb)
}

function parseProvider(raw: string | undefined): StorageProvider {
  return raw === "s3" || raw === "r2" ? raw : "local"
}

async function loadFromDB(): Promise<StorageConfig> {
  try {
    await connectDB()
    const opts = await getSiteOptions(KEYS)
    const mb = clampMaxMb(parseInt(opts.storage_max_mb || "", 10) || DEFAULT_MAX_MB)
    return {
      provider: parseProvider(opts.storage_provider),
      maxBytes: mb * 1024 * 1024,
      bucket: opts.storage_bucket || "",
      region: opts.storage_region || "",
      endpoint: opts.storage_endpoint || "",
      publicBaseUrl: (opts.storage_public_base_url || "").replace(/\/+$/, ""),
      accessKey: decryptValue(opts.storage_access_key) || "",
      secretKey: decryptValue(opts.storage_secret_key) || "",
    }
  } catch {
    return DEFAULTS
  }
}

/** Lấy config — Redis cache 5s, fallback DB. Save settings sẽ invalidate ngay. */
export async function getStorageConfig(): Promise<StorageConfig> {
  return await cached("storage:config", 5, loadFromDB)
}

/** Force reload — gọi sau khi admin save storage settings. */
export function invalidateStorageConfigCache(): void {
  void invalidate("storage:config")
}

export const STORAGE_DEFAULTS = DEFAULTS
export const STORAGE_DEFAULT_MAX_MB = DEFAULT_MAX_MB
export const STORAGE_KEYS = KEYS
