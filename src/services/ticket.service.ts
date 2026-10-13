import crypto from "node:crypto"
import { TRPCError } from "@trpc/server"
import { Types } from "mongoose"
import { Ticket, TicketMessage, type TicketStatus, type TicketSubject } from "@/models/ticket.model"
import { verifyCaptcha } from "@/lib/captcha"
import { emitToTicket, emitToUserWithAck, emitToAdmins } from "@/lib/realtime/emit"

const MAX_OPEN_TICKETS = 3

// No data cache — luôn fresh từ DB. Chỉ giữ inflight de-dupe.
const ticketListInflight = new Map<string, Promise<Awaited<ReturnType<typeof queryTickets>>>>()

export function invalidateTicketListCache(): void {
  ticketListInflight.clear()
}

export const SUBJECT_LABELS: Record<TicketSubject, string> = {
  deposit: "Nạp tiền",
  account: "Tài khoản",
  order: "Đơn hàng",
  other: "Khác",
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Đang mở",
  pending: "Chờ xử lý",
  replied: "Đã trả lời",
  closed: "Đã đóng",
}

function cleanText(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim()
}

async function generateTicketId(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const ticketId = crypto.randomBytes(4).toString("hex").toUpperCase()
    const exists = await Ticket.findOne({ ticketId }).select("_id").lean()
    if (!exists) return ticketId
  }
  throw new Error("Cannot generate ticket id")
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ID không hợp lệ" })
  }
  return new Types.ObjectId(id)
}
function serializeTicket(raw: any) {
  return {
    id: raw._id?.toString?.() ?? String(raw._id ?? ""),
    ticketId: raw.ticketId ?? "",
    userId: raw.userId?.toString?.() ?? String(raw.userId ?? ""),
    username: raw.username ?? "",
    title: raw.title ?? "",
    subject: raw.subject as TicketSubject,
    status: raw.status as TicketStatus,
    content: raw.content ?? "",
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt ?? null,
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : raw.updatedAt ?? null,
  }
}

function serializeMessage(raw: any) {
  return {
    id: raw._id?.toString?.() ?? String(raw._id ?? ""),
    senderName: raw.senderName ?? "",
    senderRole: raw.senderRole as "user" | "admin",
    content: raw.content ?? "",
    image: raw.image ?? null,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt ?? null,
  }
}

export async function getTicketStats(userId: Types.ObjectId | string) {
  const [total, open, pending, replied, closed] = await Promise.all([
    Ticket.countDocuments({ userId }),
    Ticket.countDocuments({ userId, status: "open" }),
    Ticket.countDocuments({ userId, status: "pending" }),
    Ticket.countDocuments({ userId, status: "replied" }),
    Ticket.countDocuments({ userId, status: "closed" }),
  ])
  return { total, open, pending, replied, closed }
}

async function queryTickets(input: {
  userId?: Types.ObjectId | string
  page: number
  limit: number
  search?: string
  subject?: TicketSubject
  status?: TicketStatus
  isAdmin?: boolean
}) {
  const page = Math.max(1, input.page)
  const limit = Math.min(100, Math.max(1, input.limit))
  const filter: Record<string, unknown> = {}
  if (!input.isAdmin) filter.userId = input.userId
  if (input.subject) filter.subject = input.subject
  if (input.status) filter.status = input.status
  const search = input.search?.trim()
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    filter.$or = [
      { ticketId: { $regex: `^${safe}`, $options: "i" } },
      { username: { $regex: `^${safe}`, $options: "i" } },
      { title: { $regex: safe, $options: "i" } },
    ]
  }

  const projection = "ticketId userId username title subject status content createdAt updatedAt"
  const [items, total] = await Promise.all([
    Ticket.find(filter).select(projection).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean<any[]>(),
    Ticket.countDocuments(filter),
  ])

  return {
    items: items.map(serializeTicket),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function listTickets(input: Parameters<typeof queryTickets>[0]) {
  const cacheKey = JSON.stringify({
    userId: input.isAdmin ? "admin" : String(input.userId ?? ""),
    page: input.page,
    limit: input.limit,
    search: input.search?.trim() ?? "",
    subject: input.subject ?? "",
    status: input.status ?? "",
    isAdmin: !!input.isAdmin,
  })
  const inflight = ticketListInflight.get(cacheKey)
  if (inflight) return inflight

  const pending = queryTickets(input)
    .finally(() => ticketListInflight.delete(cacheKey))
  ticketListInflight.set(cacheKey, pending)
  return pending
}

export async function createTicket(input: {
  userId: Types.ObjectId | string
  username: string
  title: string
  subject: TicketSubject
  content: string
  captchaToken?: string | null
  ip?: string | null
}) {
  const captchaOk = await verifyCaptcha(input.captchaToken, "create_ticket", input.ip ?? undefined)
  if (!captchaOk) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Captcha không hợp lệ" })
  }

  const openCount = await Ticket.countDocuments({ userId: input.userId, status: { $ne: "closed" } })
  if (openCount >= MAX_OPEN_TICKETS) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tối đa 3 ticket chưa đóng" })
  }

  const title = cleanText(input.title)
  const content = cleanText(input.content)
  if (!title || !content) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Nội dung không hợp lệ" })
  }

  const ticket = await Ticket.create({
    ticketId: await generateTicketId(),
    userId: input.userId,
    username: input.username,
    title,
    subject: input.subject,
    content,
    status: "open",
  })
  await TicketMessage.create({
    ticketId: ticket._id,
    senderId: input.userId,
    senderName: input.username,
    senderRole: "user",
    content,
  })
  invalidateTicketListCache()

  // Real-time: báo admin có ticket mới (best-effort).
  emitToAdmins("admin:newTicket", { id: String(ticket._id), title, ticketId: ticket.ticketId })

  return { success: true, message: "Đã tạo yêu cầu hỗ trợ", id: String(ticket._id) }
}

export async function getTicketById(userId: Types.ObjectId | string, id: string, isAdmin = false) {
  const ticketObjectId = toObjectId(id)
  const filter: Record<string, unknown> = { _id: ticketObjectId }
  if (!isAdmin) filter.userId = userId

  const ticket = await Ticket.findOne(filter).lean<any>()
  if (!ticket) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy ticket" })
  }

  const messages = await TicketMessage.find({ ticketId: ticketObjectId }).sort({ createdAt: 1 }).lean<any[]>()
  return { ticket: serializeTicket(ticket), messages: messages.map(serializeMessage) }
}

export async function sendTicketMessage(input: {
  userId: Types.ObjectId | string
  username: string
  ticketId: string
  content: string
  image?: string | null
  isAdmin?: boolean
}) {
  const ticketObjectId = toObjectId(input.ticketId)
  const filter: Record<string, unknown> = { _id: ticketObjectId }
  if (!input.isAdmin) filter.userId = input.userId

  const ticket = await Ticket.findOne(filter).lean<any>()
  if (!ticket) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy ticket" })
  }
  if (ticket.status === "closed") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Ticket đã đóng" })
  }

  const content = cleanText(input.content)
  if (!content) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Nội dung không hợp lệ" })
  }

  const updateResult = await Ticket.updateOne(
    { ...filter, status: { $ne: "closed" } },
    { $set: { status: input.isAdmin ? "replied" : "pending", updatedAt: new Date() } }
  )
  if (updateResult.matchedCount === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Ticket đã đóng" })
  }

  await TicketMessage.create({
    ticketId: ticketObjectId,
    senderId: input.userId,
    senderName: input.isAdmin ? "Admin" : input.username,
    senderRole: input.isAdmin ? "admin" : "user",
    content,
    image: input.image ?? null,
  })
  invalidateTicketListCache()

  // ─── Real-time (best-effort, thay thế poll 2s) ───
  const newStatus = input.isAdmin ? "replied" : "pending"
  // 1. Mọi người đang mở phòng ticket này → có tin nhắn mới.
  emitToTicket(input.ticketId, "ticket:reply", {
    ticketId: input.ticketId,
    senderRole: input.isAdmin ? "admin" : "user",
    status: newStatus,
  })
  if (input.isAdmin) {
    // Admin trả lời → báo chủ ticket (event quan trọng, #8 có ACK).
    emitToUserWithAck(ticket.userId, "ticket:reply", { ticketId: input.ticketId, status: newStatus })
  } else {
    // User trả lời → báo admin.
    emitToAdmins("admin:newTicket", { id: input.ticketId, title: ticket.title ?? "", reply: true })
  }

  return {
    success: true,
    ticketOwnerId: String(ticket.userId),
    ticketTitle: ticket.title ?? "",
    ticketCode: ticket.ticketId ?? "",
  }
}

export async function closeTicket(userId: Types.ObjectId | string, id: string, isAdmin = false) {
  const ticketObjectId = toObjectId(id)
  const filter: Record<string, unknown> = { _id: ticketObjectId }
  if (!isAdmin) filter.userId = userId
  const result = await Ticket.updateOne(filter, { $set: { status: "closed", updatedAt: new Date() } })
  if (result.matchedCount === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy ticket" })
  }
  invalidateTicketListCache()
  // Real-time: mọi người trong phòng ticket thấy trạng thái đóng ngay.
  emitToTicket(id, "ticket:status", { ticketId: id, status: "closed" })
  return { success: true, message: "Đã đóng ticket" }
}

const TICKET_CREATE_NOTE_KEY = "ticket_create_note_html"
const TICKET_CREATE_PROCESS_KEY = "ticket_create_process_html"

export const DEFAULT_TICKET_CREATE_NOTE_HTML = `<p>• Cung cấp mã giao dịch hoặc mã đơn hàng nếu liên quan.</p><p>• Tài khoản chỉ được mở tối đa 3 ticket chưa đóng.</p><p>• Không gửi mật khẩu hoặc thông tin nhạy cảm trong ticket.</p>`
export const DEFAULT_TICKET_CREATE_PROCESS_HTML = `<ol><li>Bạn gửi yêu cầu hỗ trợ.</li><li>Admin phản hồi trong khung chat 1-1.</li><li>Bạn có thể đóng ticket khi đã xử lý xong.</li></ol>`

export interface TicketCreateGuideConfig {
  noteHtml: string
  processHtml: string
}

export async function getTicketCreateGuideConfig(): Promise<TicketCreateGuideConfig> {
  const { getSiteOptions } = await import("@/models/setting.model")
  const opts = await getSiteOptions([TICKET_CREATE_NOTE_KEY, TICKET_CREATE_PROCESS_KEY])
  return {
    noteHtml: opts[TICKET_CREATE_NOTE_KEY]?.trim() || DEFAULT_TICKET_CREATE_NOTE_HTML,
    processHtml: opts[TICKET_CREATE_PROCESS_KEY]?.trim() || DEFAULT_TICKET_CREATE_PROCESS_HTML,
  }
}

export async function updateTicketCreateGuideConfig(input: TicketCreateGuideConfig): Promise<TicketCreateGuideConfig> {
  const { setSiteOptions } = await import("@/models/setting.model")
  await setSiteOptions({
    [TICKET_CREATE_NOTE_KEY]: input.noteHtml.trim(),
    [TICKET_CREATE_PROCESS_KEY]: input.processHtml.trim(),
  })
  return await getTicketCreateGuideConfig()
}
