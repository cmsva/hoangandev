/**
 * Telegram Webhook Handler
 *
 * Telegram bot sẽ POST update tới đây mỗi khi user nhắn cho bot.
 * Chỉ xử lý 1 lệnh: `/start link_<code>` để hoàn tất liên kết.
 *
 * Bảo mật: secret token láy từ constants (hardcoded), Telegram sẽ gửi header
 * `X-Telegram-Bot-Api-Secret-Token` và được verify ở đây.
 *
 * Cấu hình ở admin: gọi setTelegramWebhook(WEBHOOK_URL) một lần; secret được
 * tự động inject từ constant.
 */
import { NextResponse, type NextRequest } from "next/server"
import { confirmTelegramLink } from "@/services/profile-link.service"
import { sendTelegramUserRaw } from "@/lib/send-telegram"
import { TELEGRAM_WEBHOOK_SECRET } from "@/lib/telegram-webhook-constants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number | string; type: string; username?: string; first_name?: string }
    from?: { id: number | string; username?: string; first_name?: string }
    text?: string
  }
}

export async function POST(req: NextRequest) {
  // Verify secret token header (always required — hardcoded constant).
  const got = req.headers.get("x-telegram-bot-api-secret-token")
  if (got !== TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = (await req.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: true }) // ignore malformed
  }

  const message = update.message
  if (!message?.text) {
    return NextResponse.json({ ok: true })
  }

  const chatId = String(message.chat.id)
  const text = message.text.trim()

  // Match `/start link_<code>`
  const linkMatch = text.match(/^\/start\s+link_([a-z0-9]{4,32})\s*$/i)
  if (linkMatch) {
    const code = linkMatch[1]
    const username = message.from?.username || message.chat.username || null
    const userId = await confirmTelegramLink(code, chatId, username)
    if (!userId) {
      void sendTelegramUserRaw(
        chatId,
        "❌ <b>Liên kết thất bại</b>\nMã không hợp lệ, đã hết hạn hoặc Telegram này đã liên kết với tài khoản khác.\n\nVui lòng vào trang Profile và bấm <b>“Liên kết Telegram”</b> để lấy mã mới."
      ).catch(() => {})
    }
    // Note: thành công thì confirmTelegramLink đã gửi welcome message rồi.
    return NextResponse.json({ ok: true })
  }

  // `/start` không có code → hướng dẫn user
  if (/^\/start(\s|$)/i.test(text)) {
    void sendTelegramUserRaw(
      chatId,
      "👋 <b>Chào bạn!</b>\nĐây là bot thông báo của hệ thống. Để liên kết tài khoản, vào <b>Profile → Liên kết Telegram</b> trên website và quét QR / bấm vào liên kết được tạo."
    ).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  // Lệnh khác — bỏ qua
  return NextResponse.json({ ok: true })
}

/** GET → trả về 200 cho health check. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" })
}
