import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

/**
 * Passkey (WebAuthn credential) — mỗi document = 1 thiết bị/khóa user đã đăng ký.
 *
 * Không lưu private key — public key đủ để verify assertion. Counter chống replay.
 */

export const PASSKEY_DEVICE_TYPES = ["singleDevice", "multiDevice"] as const
export type PasskeyDeviceType = (typeof PASSKEY_DEVICE_TYPES)[number]

export interface IPasskey extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  /** base64url-encoded credential id (unique global). */
  credentialId: string
  /** CBOR-encoded public key buffer. */
  publicKey: Buffer
  /** Sign counter — verify assertion phải > counter cũ (anti-clone). */
  counter: number
  deviceType: PasskeyDeviceType
  /** Credential có được cloud-sync không (Apple iCloud, Google Password Manager...). */
  backedUp: boolean
  /** Authenticator transports — usb / nfc / ble / internal / hybrid. */
  transports: string[]
  /** Tên do user đặt (vd "MacBook Touch ID"). */
  name: string
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const passkeySchema = new Schema<IPasskey>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    credentialId: { type: String, required: true, unique: true },
    publicKey: { type: Buffer, required: true },
    counter: { type: Number, default: 0, min: 0 },
    deviceType: { type: String, enum: PASSKEY_DEVICE_TYPES, default: "singleDevice" },
    backedUp: { type: Boolean, default: false },
    transports: { type: [String], default: [] },
    name: { type: String, required: true, maxlength: 64, trim: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

passkeySchema.index({ userId: 1, createdAt: -1 })

export const Passkey = registerModel<IPasskey>("Passkey", passkeySchema)
