/**
 * Storage Service — business logic cho cấu hình lưu trữ + dispatch upload.
 * Protocol-agnostic: không phụ thuộc tRPC ctx / HTTP.
 *
 * Cung cấp:
 *  - getStorageSettings()  → config cho UI (credential ĐÃ MASK).
 *  - saveStorageSettings() → validate + encrypt credential + ghi DB + invalidate cache.
 *  - putObject()           → dispatcher local | s3 | r2, trả public URL.
 *  - testStorageConnection() → thử ghi 1 file nhỏ để verify credential.
 *
 * S3/R2 dùng chung @aws-sdk/client-s3 (R2 = S3-compatible, khác endpoint + region).
 * SDK import động → route/provider local không kéo SDK vào bundle.
 */
import path from "node:path"
import fs from "node:fs/promises"
import { TRPCError } from "@trpc/server"
import { connectDB } from "@/lib/db"
import { getSiteOptions, setSiteOptions } from "@/models/setting.model"
import { encryptValue, maskCredential } from "@/lib/encryption"
import {
  getStorageConfig,
  invalidateStorageConfigCache,
  clampMaxMb,
  type StorageConfig,
  type StorageProvider,
} from "@/lib/storage-config"

// ─── Types ───────────────────────────────────────────────────────────────

export interface StorageSettings {
  provider: StorageProvider
  maxMb: number
  bucket: string
  region: string
  endpoint: string
  publicBaseUrl: string
  /** Chỉ flag — đã có credential lưu chưa (không trả raw). */
  hasAccessKey: boolean
  hasSecretKey: boolean
  /** Credential đã mask cho UI hiển thị gợi nhớ. */
  accessKeyMasked: string
}

export interface SaveStorageInput {
  provider: StorageProvider
  maxMb: number
  bucket: string
  region: string
  endpoint: string
  publicBaseUrl: string
  /** null = giữ key cũ; "" = xóa; chuỗi = đặt mới. */
  accessKey: string | null
  secretKey: string | null
}

export interface PutObjectInput {
  buffer: Buffer
  bucket: string
  key: string
  contentType: string
}

// ─── Config read (cho UI) ──────────────────────────────────────────────────

export async function getStorageSettings(): Promise<StorageSettings> {
  await connectDB()
  const opts = await getSiteOptions([
    "storage_provider",
    "storage_max_mb",
    "storage_bucket",
    "storage_region",
    "storage_endpoint",
    "storage_public_base_url",
    "storage_access_key",
    "storage_secret_key",
  ])
  const provider = (opts.storage_provider === "s3" || opts.storage_provider === "r2")
    ? opts.storage_provider
    : "local"
  const cfg = await getStorageConfig() // đã decrypt → lấy accessKey để mask
  return {
    provider,
    maxMb: clampMaxMb(parseInt(opts.storage_max_mb || "", 10) || 5),
    bucket: opts.storage_bucket || "",
    region: opts.storage_region || "",
    endpoint: opts.storage_endpoint || "",
    publicBaseUrl: opts.storage_public_base_url || "",
    hasAccessKey: Boolean(opts.storage_access_key),
    hasSecretKey: Boolean(opts.storage_secret_key),
    accessKeyMasked: maskCredential(cfg.accessKey, 4),
  }
}

// ─── Config write ────────────────────────────────────────────────────────

export async function saveStorageSettings(input: SaveStorageInput): Promise<void> {
  await connectDB()

  const provider: StorageProvider =
    input.provider === "s3" || input.provider === "r2" ? input.provider : "local"

  // Với S3/R2: validate field bắt buộc
  if (provider === "s3" || provider === "r2") {
    if (!input.bucket.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Vui lòng nhập Bucket" })
    }
    if (provider === "r2" && !input.endpoint.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Cloudflare R2 cần Endpoint" })
    }
    if (provider === "s3" && !input.region.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Amazon S3 cần Region" })
    }
  }

  const entries: Record<string, string> = {
    storage_provider: provider,
    storage_max_mb: String(clampMaxMb(input.maxMb)),
    storage_bucket: input.bucket.trim(),
    storage_region: input.region.trim(),
    storage_endpoint: input.endpoint.trim().replace(/\/+$/, ""),
    storage_public_base_url: input.publicBaseUrl.trim().replace(/\/+$/, ""),
  }

  // Credential: null = giữ nguyên (không ghi), "" = xóa, chuỗi = encrypt + ghi
  if (input.accessKey !== null) {
    entries.storage_access_key = input.accessKey ? (encryptValue(input.accessKey) || "") : ""
  }
  if (input.secretKey !== null) {
    entries.storage_secret_key = input.secretKey ? (encryptValue(input.secretKey) || "") : ""
  }

  await setSiteOptions(entries)
  invalidateStorageConfigCache()
}

// ─── Providers ─────────────────────────────────────────────────────────────

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads")

/** Ghi local disk — hành vi cũ, trả URL tương đối /uploads/<bucket>/<name>. */
async function putLocal(input: PutObjectInput): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, input.bucket)
  await fs.mkdir(dir, { recursive: true })
  const name = path.basename(input.key)
  await fs.writeFile(path.join(dir, name), input.buffer)
  return `/uploads/${input.bucket}/${name}`
}

/** Tạo S3Client cho S3 hoặc R2 từ config. Throw nếu thiếu credential. */
async function makeS3Client(cfg: StorageConfig) {
  if (!cfg.accessKey || !cfg.secretKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Chưa cấu hình credential cho lưu trữ đám mây",
    })
  }
  const { S3Client } = await import("@aws-sdk/client-s3")
  return new S3Client({
    // R2 không có region thật → "auto". S3 dùng region thật.
    region: cfg.provider === "r2" ? "auto" : cfg.region || "us-east-1",
    // R2 cần endpoint account-specific. S3 để trống → SDK tự suy ra.
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
  })
}

/** Build public URL từ key. Ưu tiên publicBaseUrl; fallback theo provider. */
function buildPublicUrl(cfg: StorageConfig, key: string): string {
  if (cfg.publicBaseUrl) return `${cfg.publicBaseUrl}/${key}`
  if (cfg.provider === "s3") {
    const region = cfg.region || "us-east-1"
    return `https://${cfg.bucket}.s3.${region}.amazonaws.com/${key}`
  }
  // R2 không có public URL mặc định ổn định → bắt buộc publicBaseUrl.
  // Trả về key tương đối để admin nhận ra thiếu cấu hình.
  return `/${key}`
}

/** Upload qua S3/R2. Key dạng `<bucket>/<name>` để gom theo nhóm như local. */
async function putS3(cfg: StorageConfig, input: PutObjectInput): Promise<string> {
  const client = await makeS3Client(cfg)
  const { PutObjectCommand } = await import("@aws-sdk/client-s3")
  const key = `${input.bucket}/${path.basename(input.key)}`
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: input.buffer,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  return buildPublicUrl(cfg, key)
}

// ─── Public API ──────────────────────────────────────────────────────────

/** Dispatcher chính — mọi nơi upload ảnh gọi qua đây. Trả public URL. */
export async function putObject(input: PutObjectInput): Promise<string> {
  const cfg = await getStorageConfig()
  if (cfg.provider === "local") return putLocal(input)
  return putS3(cfg, input)
}

/** Thử ghi 1 file nhỏ để admin verify credential trước khi dùng thật. */
export async function testStorageConnection(): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getStorageConfig()
  if (cfg.provider === "local") return { ok: true }
  try {
    const client = await makeS3Client(cfg)
    const { PutObjectCommand } = await import("@aws-sdk/client-s3")
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: "__healthcheck/ping.txt",
        Body: Buffer.from(`ok ${Date.now()}`),
        ContentType: "text/plain",
      })
    )
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: (err?.message || "Kết nối thất bại").slice(0, 200) }
  }
}
