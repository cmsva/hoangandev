import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

// ============================================================
// Invoice — Hóa đơn nạp tiền qua ngân hàng (collection: invoices)
// ============================================================
export const INVOICE_STATUSES = [0, 1, 2] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]
// 0 = pending, 1 = paid, 2 = expired/cancelled

export interface IInvoice extends Document {
  userId: mongoose.Types.ObjectId
  transId: string
  gateway: string // bank shortName
  description: string
  amount: number
  finalAmount: number // amount + bonus
  status: InvoiceStatus
  expiredAt: Date
  /** Audit trail */
  paidAt: Date | null
  /** Ref txn id từ gateway (cron bank job, payment gateway, ...) */
  gatewayRef: string | null
  /** Charge-back reason khi reverse paid invoice */
  reverseReason: string | null
  reversedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const invoiceSchema = new Schema<IInvoice>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    transId: { type: String, required: true, unique: true },
    gateway: { type: String, required: true },
    description: { type: String, default: "" },
    amount: { type: Number, required: true },
    finalAmount: { type: Number, required: true },
    status: { type: Number, default: 0 },
    expiredAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    gatewayRef: { type: String, default: null },
    reverseReason: { type: String, default: null },
    reversedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: "invoices" }
)

invoiceSchema.index({ userId: 1, createdAt: -1 })
invoiceSchema.index({ status: 1, expiredAt: 1 })

export const Invoice = registerModel<IInvoice>("Invoice", invoiceSchema)
