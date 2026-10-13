import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// BlockedIP — Danh sách IP bị chặn (collection: blocked_ips)
// ============================================================
//
// Source:
//  - "manual"  → admin tự thêm
//  - "auto"    → hệ thống tự thêm khi vượt rate-limit
//  - "callback" → sai secret key callback nhiều lần
//
// expiresAt = null nghĩa là chặn vĩnh viễn.
// Khi có expiresAt, MongoDB TTL index tự xoá doc khi tới giờ.
// ============================================================

export const BLOCK_SOURCES = ["manual", "auto", "callback"] as const
export type BlockSource = (typeof BLOCK_SOURCES)[number]

export interface IBlockedIP extends Document {
  _id: mongoose.Types.ObjectId
  ip: string
  reason?: string | null
  source: BlockSource
  createdBy?: mongoose.Types.ObjectId | null
  hits: number
  expiresAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const blockedIpSchema = new Schema<IBlockedIP>(
  {
    ip: { type: String, required: true, unique: true, trim: true },
    reason: { type: String, default: null, maxlength: 500 },
    source: { type: String, enum: BLOCK_SOURCES, default: "manual", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    hits: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: "blocked_ips" }
)

// ESR: equality on ip (unique already), sort on createdAt
blockedIpSchema.index({ createdAt: -1 })
// TTL: tự xoá khi expiresAt qua thời điểm hiện tại
blockedIpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const BlockedIP = registerModel<IBlockedIP>("BlockedIP", blockedIpSchema)
