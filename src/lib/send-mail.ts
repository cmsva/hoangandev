/**
 * Mail Sender — gửi email user qua SMTP (nodemailer).
 * Settings: smtp_status, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from.
 *
 * Usage:
 *   await sendMailToUser(toEmail, "login", { username, ip, device, time })
 *
 * Tự động:
 *   - Build subject + html từ mail-template
 *   - Check smtp_status === "1" trước khi gửi
 *   - Check notify flag (smtp_notify_login = "1") trước khi gửi
 *   - Best-effort: catch error, không throw
 *
 * Cache (2026-05-31):
 *   - SMTP config cache Redis 60s. Admin save config → invalidate NGAY,
 *     không cần restart server. Nếu Redis chưa init → fallback DB direct.
 */
import nodemailer from "nodemailer"
import { connectDB } from "@/lib/db"
import { getSiteOptions } from "@/models/setting.model"
import { buildEmail, type MailTemplateKey } from "@/lib/mail-template"
import { cached, invalidate } from "@/lib/cache"

interface SmtpConfig {
  status: string
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

const SMTP_CACHE_KEY = "smtp:config"
const SMTP_CACHE_TTL_SEC = 60

async function loadSmtpFromDB(): Promise<SmtpConfig> {
  await connectDB()
  const opts = await getSiteOptions([
    "smtp_status",
    "smtp_host",
    "smtp_port",
    "smtp_secure",
    "smtp_user",
    "smtp_pass",
    "smtp_from",
  ])
  return {
    status: opts.smtp_status || "0",
    host: opts.smtp_host || "",
    port: Number(opts.smtp_port) || 587,
    secure: opts.smtp_secure === "1",
    user: opts.smtp_user || "",
    pass: opts.smtp_pass || "",
    from: opts.smtp_from || opts.smtp_user || "no-reply@localhost",
  }
}

async function getSmtpConfig(): Promise<SmtpConfig> {
  return await cached(SMTP_CACHE_KEY, SMTP_CACHE_TTL_SEC, loadSmtpFromDB)
}

/** Invalidate cache — admin gọi sau khi save SMTP config. */
export function invalidateMailConfigCache(): void {
  void invalidate(SMTP_CACHE_KEY)
}

/** Map từ template key → notify flag key (settings) — admin có thể tắt từng loại. */
const NOTIFY_FLAG_MAP: Record<MailTemplateKey, string> = {
  verify_email: "smtp_notify_verify_email",
  login: "smtp_notify_login",
  forgot_password: "smtp_notify_forgot_password",
  change_password: "smtp_notify_change_password",
  deposit_success: "smtp_notify_deposit_success",
  order_website: "smtp_notify_order_website",
  order_domain: "smtp_notify_order_domain",
  order_cronjob: "smtp_notify_order_cronjob",
  renew_cronjob: "smtp_notify_renew_cronjob",
  order_logo: "smtp_notify_order_logo",
  order_status: "smtp_notify_order_status",
  ticket_reply: "smtp_notify_ticket_reply",
}

export async function isMailEnabled(key: MailTemplateKey): Promise<boolean> {
  const flag = NOTIFY_FLAG_MAP[key]
  if (!flag) return false
  const cfg = await getSmtpConfig()
  if (cfg.status !== "1" || !cfg.host || !cfg.user) return false
  const opts = await getSiteOptions([flag])
  return opts[flag] === "1"
}

/**
 * Send mail with template.
 * Throws → caller có thể try/catch nếu cần. Mặc định caller dùng .catch(() => {}).
 */
export async function sendMailToUser(
  toEmail: string,
  templateKey: MailTemplateKey,
  vars: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  if (!toEmail) return { success: false, error: "no recipient" }
  if (!(await isMailEnabled(templateKey))) {
    return { success: false, error: "mail disabled or notify off" }
  }
  const cfg = await getSmtpConfig()
  try {
    const { subject, html } = await buildEmail(templateKey, vars)
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    })
    await transporter.sendMail({
      from: cfg.from,
      to: toEmail,
      subject,
      html,
    })
    return { success: true }
  } catch (err: any) {
    console.error("[sendMailToUser]", templateKey, err?.message || err)
    return { success: false, error: err?.message || String(err) }
  }
}

/** Send raw mail (cho test connection). */
export async function sendRawMail(
  toEmail: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const cfg = await getSmtpConfig()
  if (cfg.status !== "1" || !cfg.host || !cfg.user) {
    return { success: false, error: "SMTP chưa cấu hình hoặc đã tắt" }
  }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    })
    await transporter.sendMail({ from: cfg.from, to: toEmail, subject, html })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}
