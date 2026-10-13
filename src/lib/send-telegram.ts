/**
 * Telegram Sender — gửi notification cho ADMIN (admin chat) hoặc USER (đã liên kết).
 *
 * Settings:
 *   - telegram_status, telegram_token, telegram_chat_id  → admin notifications
 *   - telegram_user_status                              → bật/tắt thông báo user
 *
 * User notification dùng cùng bot token (telegram_token) nhưng gửi tới
 * `user.telegramId` đã liên kết qua flow profile-link.
 *
 * Cache (2026-05-31):
 *   - Telegram config cache Redis 60s. Admin save config → invalidate NGAY,
 *     không cần restart server. Nếu Redis chưa init → fallback DB direct.
 */
import { connectDB } from "@/lib/db"
import { getSiteOptions } from "@/models/setting.model"
import {
  buildTelegramMessage,
  type TelegramAdminKey,
  type TelegramUserKey,
} from "@/lib/telegram-template"
import { cached, invalidate } from "@/lib/cache"

interface TelegramConfig {
  status: string
  token: string
  chatId: string
  userStatus: string
}

const TG_CACHE_KEY = "telegram:config"
const TG_CACHE_TTL_SEC = 60

async function loadTelegramFromDB(): Promise<TelegramConfig> {
  await connectDB()
  const opts = await getSiteOptions([
    "telegram_status",
    "telegram_token",
    "telegram_chat_id",
    "telegram_user_status",
  ])
  return {
    status: opts.telegram_status || "0",
    token: opts.telegram_token || "",
    chatId: opts.telegram_chat_id || "",
    userStatus: opts.telegram_user_status || "0",
  }
}

async function getTelegramConfig(): Promise<TelegramConfig> {
  return await cached(TG_CACHE_KEY, TG_CACHE_TTL_SEC, loadTelegramFromDB)
}

/** Invalidate cache — admin gọi sau khi save Telegram config. */
export function invalidateTelegramConfigCache(): void {
  void invalidate(TG_CACHE_KEY)
}

/**
 * Internal — POST sendMessage tới Telegram API.
 */
async function postSendMessage(
  token: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: errText }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}

// ─── ADMIN ─────────────────────────────────────────────────────────────────

/**
 * Send raw message tới admin chat (HTML parse_mode).
 * Dùng cho test endpoint.
 */
export async function sendTelegramRaw(
  text: string
): Promise<{ success: boolean; error?: string }> {
  const cfg = await getTelegramConfig()
  if (cfg.status !== "1" || !cfg.token || !cfg.chatId) {
    return { success: false, error: "Telegram chưa cấu hình hoặc đã tắt" }
  }
  return postSendMessage(cfg.token, cfg.chatId, text)
}

/**
 * Send admin notification với template.
 * Best-effort: catch error nội bộ, không throw.
 */
export async function sendTelegramAdmin(
  templateKey: TelegramAdminKey,
  vars: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const cfg = await getTelegramConfig()
  if (cfg.status !== "1" || !cfg.token || !cfg.chatId) {
    return { success: false, error: "Telegram admin disabled" }
  }
  try {
    const message = await buildTelegramMessage(templateKey, vars)
    return await postSendMessage(cfg.token, cfg.chatId, message)
  } catch (err: any) {
    console.error("[sendTelegramAdmin]", templateKey, err?.message || err)
    return { success: false, error: err?.message || String(err) }
  }
}

// ─── USER ──────────────────────────────────────────────────────────────────

/**
 * Send notification tới USER đã liên kết Telegram.
 *
 * @param chatId  user.telegramId (chat_id of user's private chat with bot)
 * @param templateKey  user_* template key
 * @param vars         template variables
 */
export async function sendTelegramUser(
  chatId: string | null | undefined,
  templateKey: TelegramUserKey,
  vars: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  if (!chatId) return { success: false, error: "user chưa liên kết telegram" }
  const cfg = await getTelegramConfig()
  if (cfg.userStatus !== "1" || !cfg.token) {
    return { success: false, error: "Telegram user notify disabled" }
  }
  try {
    const message = await buildTelegramMessage(templateKey, vars)
    return await postSendMessage(cfg.token, chatId, message)
  } catch (err: any) {
    console.error("[sendTelegramUser]", templateKey, err?.message || err)
    return { success: false, error: err?.message || String(err) }
  }
}

/**
 * Send raw message tới USER chat (cho `user_link_success` post-link confirm).
 */
export async function sendTelegramUserRaw(
  chatId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const cfg = await getTelegramConfig()
  if (!cfg.token) return { success: false, error: "Bot token chưa cấu hình" }
  return postSendMessage(cfg.token, chatId, text)
}

/**
 * Set / clear Telegram bot webhook.
 * Caller dùng khi admin lưu cấu hình hoặc khi cần re-register webhook.
 */
export async function setTelegramWebhook(
  webhookUrl: string,
  secretToken?: string
): Promise<{ success: boolean; error?: string; description?: string }> {
  const cfg = await getTelegramConfig()
  if (!cfg.token) return { success: false, error: "Bot token chưa cấu hình" }
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken || undefined,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json()
    if (!data?.ok) return { success: false, error: data?.description || "Set webhook failed" }
    return { success: true, description: data.description }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}
