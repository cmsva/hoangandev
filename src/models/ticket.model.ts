import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

export const TICKET_SUBJECTS = ["deposit", "account", "order", "other"] as const
export type TicketSubject = (typeof TICKET_SUBJECTS)[number]

export const TICKET_STATUSES = ["open", "pending", "replied", "closed"] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export interface ITicket extends Document {
  _id: mongoose.Types.ObjectId
  ticketId: string
  userId: mongoose.Types.ObjectId
  username: string
  title: string
  subject: TicketSubject
  content: string
  status: TicketStatus
  createdAt: Date
  updatedAt: Date
}

export interface ITicketMessage extends Document {
  _id: mongoose.Types.ObjectId
  ticketId: mongoose.Types.ObjectId
  senderId: mongoose.Types.ObjectId
  senderName: string
  senderRole: "user" | "admin"
  content: string
  image: string | null
  createdAt: Date
}
const ticketSchema = new Schema<ITicket>(
  {
    ticketId: { type: String, required: true, unique: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subject: { type: String, enum: TICKET_SUBJECTS, required: true, index: true },
    content: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: TICKET_STATUSES, default: "open", index: true },
  },
  { timestamps: true, versionKey: false }
)

ticketSchema.index({ userId: 1, createdAt: -1 })
ticketSchema.index({ userId: 1, status: 1, updatedAt: -1 })
ticketSchema.index({ status: 1, updatedAt: -1 })
ticketSchema.index({ username: 1, updatedAt: -1 })
ticketSchema.index({ title: "text", ticketId: "text", username: "text" })

const ticketMessageSchema = new Schema<ITicketMessage>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true, trim: true },
    senderRole: { type: String, enum: ["user", "admin"], required: true },
    content: { type: String, required: true, maxlength: 2000 },
    image: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
)

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 })

export const Ticket = registerModel<ITicket>("Ticket", ticketSchema)
export const TicketMessage = registerModel<ITicketMessage>("TicketMessage", ticketMessageSchema)
