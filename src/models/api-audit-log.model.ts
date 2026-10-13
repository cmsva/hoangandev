/**
 * ApiAuditLog — log mỗi request tới `/api/agency/...`.
 * TTL 30 ngày tự động xóa qua MongoDB index.
 *
 * Mục đích:
 *  - Forensic: tra ai/IP gọi endpoint nào, lúc nào, status gì
 *  - Hiển thị 100 request gần nhất ở /document-api
 *  - Đếm usage cho `account/usage`
 */
import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

export interface IApiAuditLog extends Document {
  _id: mongoose.Types.ObjectId
  apiKeyId: mongoose.Types.ObjectId | null
  userId: mongoose.Types.ObjectId | null
  ip: string
  method: string
  path: string
  status: number
  latencyMs: number
  errorCode: string | null
  ua: string | null
  ts: Date
}

const apiAuditLogSchema = new Schema<IApiAuditLog>(
  {
    apiKeyId: { type: Schema.Types.ObjectId, ref: "ApiKey", default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    ip: { type: String, required: true, maxlength: 64 },
    method: { type: String, required: true, maxlength: 16 },
    path: { type: String, required: true, maxlength: 500 },
    status: { type: Number, required: true },
    latencyMs: { type: Number, default: 0, min: 0 },
    errorCode: { type: String, default: null, maxlength: 80 },
    ua: { type: String, default: null, maxlength: 500 },
    ts: { type: Date, default: () => new Date() },
  },
  { timestamps: false, versionKey: false }
)

// TTL 30 ngày
apiAuditLogSchema.index({ ts: 1 }, { expireAfterSeconds: 30 * 86400 })
// List recent by key
apiAuditLogSchema.index({ apiKeyId: 1, ts: -1 })
apiAuditLogSchema.index({ userId: 1, ts: -1 })

export const ApiAuditLog = registerModel<IApiAuditLog>("ApiAuditLog", apiAuditLogSchema)
