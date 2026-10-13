/**
 * Notification Service — fire-and-forget helpers cho từng business event.
 *
 * Mỗi helper:
 *   - Tự lookup user email + telegramId
 *   - Gửi mail (nếu user đã verify email + smtp_notify flag bật)
 *   - Gửi tele user (nếu user đã link telegram + telegram_user_status bật)
 *   - Gửi tele admin
 *   - Best-effort: catch error không throw, log console
 *
 * Caller chỉ cần:
 *   void notifyDepositSuccess({ userId, amount, method, balance, transId })
 */
import { Types } from "mongoose"
import { connectDB } from "@/lib/db"
import { User } from "@/models/user.model"
import { sendMailToUser } from "@/lib/send-mail"
import { sendTelegramAdmin, sendTelegramUser } from "@/lib/send-telegram"
import type { MailTemplateKey } from "@/lib/mail-template"
import { createForUser as createInAppNotification } from "@/services/notification.service"
import { escapeHtml } from "@/lib/sanitize"

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ"
const now = () => new Date().toLocaleString("vi-VN")

interface UserSnapshot {
  email: string | null
  username: string
  fullname: string | null
  emailVerified: number
  telegramId: string | null
}

async function loadUser(userId: Types.ObjectId | string): Promise<UserSnapshot | null> {
  await connectDB()
  const user = await User.findById(userId)
    .select("email username fullname emailVerified telegramId")
    .lean<UserSnapshot | null>()
  return user
}

/** Helper: nên gửi mail (user verified email)? */
function canMail(user: UserSnapshot): boolean {
  return !!user.email && user.emailVerified === 1
}

// ─── Auth events ─────────────────────────────────────────────────────────

export async function notifyLogin(input: {
  userId: string | Types.ObjectId
  ip: string | null
  device: string | null
}): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    const username = user.fullname || user.username
    const ip = input.ip || "unknown"
    const device = input.device || "unknown"
    const time = now()

    if (canMail(user)) {
      void sendMailToUser(user.email!, "login", { username, ip, device, time }).catch(() => {})
    }
    void sendTelegramUser(user.telegramId, "user_login", { username, ip, device, time }).catch(() => {})
    void createInAppNotification(input.userId, {
      type: "auth",
      source: "system",
      title: "Đăng nhập từ thiết bị mới",
      content: `IP: <strong>${escapeHtml(ip)}</strong> · Thiết bị: ${escapeHtml(device)}<br/>Thời gian: ${escapeHtml(time)}`,
      link: "/customer/profile?tab=security",
    })
  } catch (err) {
    console.error("[notifyLogin]", err)
  }
}

export async function notifyRegister(input: {
  userId: string | Types.ObjectId
  ip: string | null
  device: string | null
  ref?: string | null
}): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    void sendTelegramAdmin("admin_register", {
      username: user.username,
      email: user.email || "",
      ip: input.ip || "unknown",
      device: input.device || "unknown",
      ref: input.ref || "—",
      time: now(),
    }).catch(() => {})
  } catch (err) {
    console.error("[notifyRegister]", err)
  }
}

export async function notifyChangePassword(input: {
  userId: string | Types.ObjectId
  ip: string | null
  device: string | null
}): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    if (!canMail(user)) return
    void sendMailToUser(user.email!, "change_password", {
      username: user.fullname || user.username,
      ip: input.ip || "unknown",
      device: input.device || "unknown",
      time: now(),
    }).catch(() => {})
    void createInAppNotification(input.userId, {
      type: "auth",
      source: "system",
      title: "Mật khẩu đã được thay đổi",
      content: `IP: <strong>${escapeHtml(input.ip || "unknown")}</strong> · Thiết bị: ${escapeHtml(input.device || "unknown")}`,
    })
  } catch (err) {
    console.error("[notifyChangePassword]", err)
  }
}

// ─── Deposit ─────────────────────────────────────────────────────────────

export async function notifyInvoice(input: {
  userId: string | Types.ObjectId
  amount: number
  price: number
  method: string
}): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    void sendTelegramAdmin("admin_invoice", {
      username: user.username,
      amount: fmt(input.amount),
      price: fmt(input.price),
      method: input.method,
      time: now(),
    }).catch(() => {})
    void createInAppNotification(input.userId, {
      type: "deposit",
      source: "system",
      title: "Hóa đơn nạp tiền đã được tạo",
      content: `Hóa đơn <strong>${fmt(input.amount)}</strong> qua ${escapeHtml(input.method)}. Vui lòng thanh toán.`,
      link: "/customer/deposit",
    })
  } catch (err) {
    console.error("[notifyInvoice]", err)
  }
}

export async function notifyDepositSuccess(input: {
  userId: string | Types.ObjectId
  amount: number
  balance: number
  method: string
  transId?: string
}): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    const username = user.fullname || user.username
    const amount = fmt(input.amount)
    const balance = fmt(input.balance)
    const time = now()

    if (canMail(user)) {
      void sendMailToUser(user.email!, "deposit_success", {
        username,
        amount,
        balance,
        method: input.method,
        time,
      }).catch(() => {})
    }
    void sendTelegramAdmin("admin_deposit", {
      username: user.username,
      amount,
      method: input.method,
      trans_id: input.transId || "—",
      time,
    }).catch(() => {})
    void sendTelegramUser(user.telegramId, "user_deposit", {
      username,
      amount,
      method: input.method,
      time,
    }).catch(() => {})
    void createInAppNotification(input.userId, {
      type: "deposit",
      source: "system",
      title: "Nạp tiền thành công",
      content: `Đã cộng <strong>${amount}</strong> vào số dư · Số dư hiện tại: <strong>${balance}</strong>`,
      link: "/customer/deposit",
    })
  } catch (err) {
    console.error("[notifyDepositSuccess]", err)
  }
}

export async function notifyCardRecharge(input: {
  userId: string | Types.ObjectId
  amount: number
  price: number
  method: string
}): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    void sendTelegramAdmin("admin_card_recharge", {
      username: user.username,
      amount: fmt(input.amount),
      price: fmt(input.price),
      method: input.method,
      time: now(),
    }).catch(() => {})
  } catch (err) {
    console.error("[notifyCardRecharge]", err)
  }
}

// ─── Orders ─────────────────────────────────────────────────────────────

interface OrderEventBase {
  userId: string | Types.ObjectId
  total: number
}

export async function notifyOrderWebsite(
  input: OrderEventBase & { productName: string }
): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    const username = user.fullname || user.username
    const total = fmt(input.total)
    const time = now()

    if (canMail(user)) {
      void sendMailToUser(user.email!, "order_website", {
        username,
        product_name: input.productName,
        total,
        time,
      }).catch(() => {})
    }
    void sendTelegramAdmin("admin_order_website", {
      username: user.username,
      product_name: input.productName,
      total,
      time,
    }).catch(() => {})
    void sendTelegramUser(user.telegramId, "user_order", {
      username,
      service: input.productName,
      total,
      time,
    }).catch(() => {})
    void createInAppNotification(input.userId, {
      type: "order",
      source: "system",
      title: "Đơn hàng website mới",
      content: `Đơn <strong>${escapeHtml(input.productName)}</strong> · Tổng: <strong>${total}</strong>`,
      link: "/customer/history",
    })
  } catch (err) {
    console.error("[notifyOrderWebsite]", err)
  }
}

export async function notifyOrderDomain(
  input: OrderEventBase & { domainName: string }
): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    const username = user.fullname || user.username
    const total = fmt(input.total)
    const time = now()

    if (canMail(user)) {
      void sendMailToUser(user.email!, "order_domain", {
        username,
        domain_name: input.domainName,
        total,
        time,
      }).catch(() => {})
    }
    void sendTelegramAdmin("admin_order_domain", {
      username: user.username,
      domain_name: input.domainName,
      total,
      time,
    }).catch(() => {})
    void sendTelegramUser(user.telegramId, "user_order", {
      username,
      service: `Domain ${input.domainName}`,
      total,
      time,
    }).catch(() => {})
    void createInAppNotification(input.userId, {
      type: "order",
      source: "system",
      title: "Đơn hàng tên miền mới",
      content: `Tên miền <strong>${escapeHtml(input.domainName)}</strong> · Tổng: <strong>${total}</strong>`,
      link: "/customer/history",
    })
  } catch (err) {
    console.error("[notifyOrderDomain]", err)
  }
}

export async function notifyOrderCronjob(
  input: OrderEventBase & {
    url: string
    interval: number
    months: number
  }
): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    const username = user.fullname || user.username
    const total = fmt(input.total)
    const time = now()
    const interval = String(input.interval)
    const months = String(input.months)

    if (canMail(user)) {
      void sendMailToUser(user.email!, "order_cronjob", {
        username,
        url: input.url,
        interval,
        months,
        total,
        time,
      }).catch(() => {})
    }
    void sendTelegramAdmin("admin_order_cronjob", {
      username: user.username,
      url: input.url,
      interval,
      months,
      total,
      time,
    }).catch(() => {})
    void sendTelegramUser(user.telegramId, "user_order", {
      username,
      service: `CronJob ${input.url}`,
      total,
      time,
    }).catch(() => {})
    void createInAppNotification(input.userId, {
      type: "order",
      source: "system",
      title: "Đơn cronjob mới",
      content: `<strong>${escapeHtml(input.url)}</strong> · ${escapeHtml(months)} tháng · Tổng: <strong>${total}</strong>`,
      link: "/customer/history",
    })
  } catch (err) {
    console.error("[notifyOrderCronjob]", err)
  }
}

export async function notifyRenewCronjob(
  input: OrderEventBase & {
    url: string
    months: number
  }
): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    const username = user.fullname || user.username
    const total = fmt(input.total)
    const time = now()
    const months = String(input.months)

    if (canMail(user)) {
      void sendMailToUser(user.email!, "renew_cronjob", {
        username,
        url: input.url,
        months,
        total,
        time,
      }).catch(() => {})
    }
    void sendTelegramAdmin("admin_renew_cronjob", {
      username: user.username,
      url: input.url,
      months,
      total,
      time,
    }).catch(() => {})
    void sendTelegramUser(user.telegramId, "user_order", {
      username,
      service: `Gia hạn CronJob ${input.url}`,
      total,
      time,
    }).catch(() => {})
  } catch (err) {
    console.error("[notifyRenewCronjob]", err)
  }
}

export async function notifyOrderLogo(
  input: OrderEventBase & {
    logoName: string
    shopName: string
  }
): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    const username = user.fullname || user.username
    const total = fmt(input.total)
    const time = now()

    if (canMail(user)) {
      void sendMailToUser(user.email!, "order_logo", {
        username,
        logo_name: input.logoName,
        shop_name: input.shopName,
        total,
        time,
      }).catch(() => {})
    }
    void sendTelegramAdmin("admin_order_logo", {
      username: user.username,
      logo_name: input.logoName,
      shop_name: input.shopName,
      total,
      time,
    }).catch(() => {})
    void sendTelegramUser(user.telegramId, "user_order", {
      username,
      service: `Logo ${input.logoName}`,
      total,
      time,
    }).catch(() => {})
    void createInAppNotification(input.userId, {
      type: "order",
      source: "system",
      title: "Đơn logo mới",
      content: `<strong>${escapeHtml(input.logoName)}</strong> · Shop ${escapeHtml(input.shopName)} · Tổng: <strong>${total}</strong>`,
      link: "/customer/history",
    })
  } catch (err) {
    console.error("[notifyOrderLogo]", err)
  }
}

// ─── Order status update (admin → user) ─────────────────────────────────

export async function notifyOrderStatus(input: {
  userId: string | Types.ObjectId
  orderType: string
  orderName: string
  status: string
}): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    const username = user.fullname || user.username
    const time = now()

    if (canMail(user)) {
      void sendMailToUser(user.email!, "order_status", {
        username,
        order_type: input.orderType,
        order_name: input.orderName,
        status: input.status,
        time,
      }).catch(() => {})
    }
    void sendTelegramUser(user.telegramId, "user_order_status", {
      username,
      order_type: input.orderType,
      order_name: input.orderName,
      status: input.status,
      time,
    }).catch(() => {})
    void createInAppNotification(input.userId, {
      type: "service",
      source: "system",
      title: `Cập nhật trạng thái: ${input.orderName}`,
      content: `Trạng thái mới: <strong>${escapeHtml(input.status)}</strong>`,
      link: "/customer/history",
    })
  } catch (err) {
    console.error("[notifyOrderStatus]", err)
  }
}

// ─── Tickets ─────────────────────────────────────────────────────────────

export async function notifyTicketNew(input: {
  userId: string | Types.ObjectId
  ticketId: string
  title: string
}): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    void sendTelegramAdmin("admin_ticket_new", {
      username: user.username,
      ticket_id: input.ticketId,
      title: input.title,
      time: now(),
    }).catch(() => {})
  } catch (err) {
    console.error("[notifyTicketNew]", err)
  }
}

export async function notifyTicketReply(input: {
  userId: string | Types.ObjectId
  ticketId: string
  ticketTitle: string
  message: string
}): Promise<void> {
  try {
    const user = await loadUser(input.userId)
    if (!user) return
    const username = user.fullname || user.username
    const time = now()

    if (canMail(user)) {
      void sendMailToUser(user.email!, "ticket_reply", {
        username,
        ticket_id: input.ticketId,
        ticket_title: input.ticketTitle,
        message: input.message,
        time,
      }).catch(() => {})
    }
    void sendTelegramUser(user.telegramId, "user_ticket_reply", {
      username,
      ticket_id: input.ticketId,
      title: input.ticketTitle,
      message: input.message,
      time,
    }).catch(() => {})
    void createInAppNotification(input.userId, {
      type: "ticket",
      source: "system",
      title: `Trả lời vé #${input.ticketId}`,
      content: `<strong>${escapeHtml(input.ticketTitle)}</strong>: ${escapeHtml(input.message.slice(0, 200))}`,
      link: `/customer/history/ticket/${input.ticketId}`,
    })
  } catch (err) {
    console.error("[notifyTicketReply]", err)
  }
}

// Used internally to suppress unused MailTemplateKey
void (null as MailTemplateKey | null)
