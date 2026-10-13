/**
 * Hardcoded telegram webhook constants.
 *
 * - WEBHOOK_PATH: endpoint mà Telegram gọi tới (đăng ký với BotFather/setWebhook).
 *   Giữ ổn định để webhook đã đăng ký ở Telegram không bị chết khi deploy lại.
 * - WEBHOOK_SECRET: token verify header `X-Telegram-Bot-Api-Secret-Token`.
 *   Sinh ngẫu nhiên 1 lần và cố định trong code (không để env, không để DB).
 *
 * Khi đăng ký webhook qua admin → tự động dùng SECRET này.
 */
export const TELEGRAM_WEBHOOK_PATH = "/api/telegram/webhook"

export const TELEGRAM_WEBHOOK_SECRET =
  "vk_tg_whsk_2026_8f3e9a1c4b7d6e5f0a2c8b1d9e3f7a4c"
