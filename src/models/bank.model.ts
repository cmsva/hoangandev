import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Bank — Ngân hàng nhận tiền (collection: bank)
// ============================================================

export const BANK_API_PROVIDERS = ["none", "coderent", "thueapibank", "acb", "mbbank", "ocb"] as const
export type BankApiProvider = (typeof BANK_API_PROVIDERS)[number]

export interface IBank extends Document {
  shortName: string
  accountNumber: string
  accountName: string
  status: number // 1=active, 0=inactive

  /** Provider API tự động lấy giao dịch (none = thủ công) */
  apiProvider: BankApiProvider
  /** Token API (encrypted AES-256-GCM) — dùng cho coderent/thueapibank */
  apiToken: string | null
  /** Username iBanking (encrypted) — dùng cho acb/mbbank/ocb */
  bankUsername: string | null
  /** Password iBanking (encrypted, MD5 cho mbbank trước khi encrypt) */
  bankPassword: string | null
  /** Device ID cho MBBank (auto-generated nếu rỗng) */
  deviceId: string | null

  /** Monitoring */
  lastCheckAt: Date | null
  lastError: string | null
  /** Số dư đọc từ provider (chỉ OCB hỗ trợ) — nullable */
  balance: number | null
}

const bankSchema = new Schema<IBank>(
  {
    shortName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    status: { type: Number, default: 1 },

    apiProvider: { type: String, enum: BANK_API_PROVIDERS, default: "none" },
    apiToken: { type: String, default: null },
    bankUsername: { type: String, default: null },
    bankPassword: { type: String, default: null },
    deviceId: { type: String, default: null },

    lastCheckAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    balance: { type: Number, default: null },
  },
  { timestamps: true, versionKey: false, collection: "bank" }
)

bankSchema.index({ status: 1 })
bankSchema.index({ shortName: 1, status: 1 }) // cron query

export const Bank = registerModel<IBank>("Bank", bankSchema)

// ============================================================
// BankSession — Cache session login cho direct API (acb/mbbank/ocb)
// ============================================================

export interface IBankSession extends Document {
  bankId: mongoose.Types.ObjectId
  /** Lower-case provider key: acb/mbbank/ocb */
  bankType: string
  /** JSON serialize của session — sẽ encrypt nếu chứa token */
  sessionData: string
  expiresAt: Date
  status: number // 1=active, 0=invalidated
}

const bankSessionSchema = new Schema<IBankSession>(
  {
    bankId: { type: Schema.Types.ObjectId, required: true, ref: "Bank" },
    bankType: { type: String, required: true, lowercase: true },
    sessionData: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: Number, default: 1 },
  },
  { timestamps: true, versionKey: false, collection: "bank_session" }
)

bankSessionSchema.index({ bankId: 1, bankType: 1, status: 1 })
// TTL — auto delete khi expiresAt qua. expiredAfterSeconds: 0 ⇒ Mongo tự xóa.
bankSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const BankSession = registerModel<IBankSession>("BankSession", bankSessionSchema)

// ─── Bank name lookup ──────────────────────────────────────────────────────

export const BANK_LIST: Record<string, string> = {
  MOMO: "Ví điện tử MOMO",
  VietinBank: "Ngân hàng TMCP Công thương Việt Nam",
  Vietcombank: "Ngân hàng TMCP Ngoại Thương Việt Nam",
  BIDV: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
  Agribank: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam",
  OCB: "Ngân hàng TMCP Phương Đông",
  MBBank: "Ngân hàng TMCP Quân đội",
  Techcombank: "Ngân hàng TMCP Kỹ thương Việt Nam",
  ACB: "Ngân hàng TMCP Á Châu",
  VPBank: "Ngân hàng TMCP Việt Nam Thịnh Vượng",
  TPBank: "Ngân hàng TMCP Tiên Phong",
  Sacombank: "Ngân hàng TMCP Sài Gòn Thương Tín",
  HDBank: "Ngân hàng TMCP Phát triển TP.HCM",
  VIB: "Ngân hàng TMCP Quốc tế Việt Nam",
  SHB: "Ngân hàng TMCP Sài Gòn - Hà Nội",
  MSB: "Ngân hàng TMCP Hàng Hải",
  SeABank: "Ngân hàng TMCP Đông Nam Á",
  LienVietPostBank: "Ngân hàng TMCP Bưu Điện Liên Việt",
}
