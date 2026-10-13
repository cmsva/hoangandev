/**
 * Mail Template Engine — Lưu/render template email cho USER.
 *
 * Storage: settings collection key `mail_tpl_{key}_title` / `mail_tpl_{key}_body`.
 * Render: replace `{var}` placeholders.
 *
 * Catalog đã đồng bộ với các dịch vụ thực có trong codebase:
 *   - verify_email      Xác minh email (OTP)
 *   - login             Thông báo đăng nhập
 *   - forgot_password   Quên mật khẩu (OTP)
 *   - change_password   Đổi mật khẩu thành công
 *   - deposit_success   Nạp tiền thành công
 *   - order_website     Mua mã nguồn / website
 *   - order_domain      Đăng ký tên miền
 *   - order_cronjob     Mua CronJob
 *   - renew_cronjob     Gia hạn CronJob
 *   - order_logo        Đặt thiết kế logo
 *   - order_status      Cập nhật trạng thái đơn hàng (admin update)
 *   - ticket_reply      Phản hồi yêu cầu hỗ trợ
 */
import { getSiteOptions, setSiteOption } from "@/models/setting.model"

// ═══ Catalog ════════════════════════════════════════════════════════════════

export const MAIL_TEMPLATE_KEYS = {
  verify_email: {
    label: "Xác minh email",
    desc: "Gửi OTP khi user yêu cầu xác minh email",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{otp}", desc: "Mã OTP" },
    ],
  },
  login: {
    label: "Thông báo đăng nhập",
    desc: "Gửi khi đăng nhập thành công (nếu user đã verify email)",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{ip}", desc: "IP" },
      { key: "{device}", desc: "Thiết bị" },
      { key: "{time}", desc: "Thời gian" },
    ],
  },
  forgot_password: {
    label: "Quên mật khẩu",
    desc: "Gửi link đặt lại mật khẩu khi user yêu cầu",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{reset_link}", desc: "Link đặt lại mật khẩu" },
    ],
  },
  change_password: {
    label: "Đổi mật khẩu",
    desc: "Gửi khi user đổi mật khẩu thành công",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{ip}", desc: "IP" },
      { key: "{device}", desc: "Thiết bị" },
      { key: "{time}", desc: "Thời gian" },
    ],
  },
  deposit_success: {
    label: "Nạp tiền thành công",
    desc: "Gửi khi nạp tiền hoàn tất (bank/card)",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{amount}", desc: "Số tiền" },
      { key: "{balance}", desc: "Số dư" },
      { key: "{method}", desc: "Phương thức" },
      { key: "{time}", desc: "Thời gian" },
    ],
  },
  order_website: {
    label: "Mua Mã nguồn / Website",
    desc: "Gửi khi mua source code (one-time)",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{product_name}", desc: "Sản phẩm" },
      { key: "{total}", desc: "Tổng tiền" },
      { key: "{time}", desc: "Thời gian" },
    ],
  },
  order_domain: {
    label: "Đăng ký Tên miền",
    desc: "Gửi khi đăng ký domain thành công",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{domain_name}", desc: "Tên miền" },
      { key: "{total}", desc: "Tổng tiền" },
      { key: "{time}", desc: "Thời gian" },
    ],
  },
  order_cronjob: {
    label: "Mua CronJob",
    desc: "Gửi khi mua CronJob",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{url}", desc: "URL CronJob" },
      { key: "{interval}", desc: "Interval (giây)" },
      { key: "{months}", desc: "Số tháng" },
      { key: "{total}", desc: "Tổng tiền" },
      { key: "{time}", desc: "Thời gian" },
    ],
  },
  renew_cronjob: {
    label: "Gia hạn CronJob",
    desc: "Gửi khi gia hạn CronJob",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{url}", desc: "URL CronJob" },
      { key: "{months}", desc: "Số tháng" },
      { key: "{total}", desc: "Tổng tiền" },
      { key: "{time}", desc: "Thời gian" },
    ],
  },
  order_logo: {
    label: "Đặt Logo",
    desc: "Gửi khi đặt thiết kế logo",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{logo_name}", desc: "Đơn hàng logo" },
      { key: "{shop_name}", desc: "Tên shop" },
      { key: "{total}", desc: "Tổng tiền" },
      { key: "{time}", desc: "Thời gian" },
    ],
  },
  order_status: {
    label: "Cập nhật đơn hàng",
    desc: "Gửi khi admin cập nhật trạng thái đơn hàng",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{order_type}", desc: "Loại đơn" },
      { key: "{order_name}", desc: "Tên đơn" },
      { key: "{status}", desc: "Trạng thái" },
      { key: "{time}", desc: "Thời gian" },
    ],
  },
  ticket_reply: {
    label: "Phản hồi ticket",
    desc: "Gửi khi admin phản hồi yêu cầu hỗ trợ",
    vars: [
      { key: "{domain}", desc: "Link Website" },
      { key: "{title}", desc: "Tên website" },
      { key: "{username}", desc: "Tên KH" },
      { key: "{ticket_id}", desc: "Mã ticket" },
      { key: "{ticket_title}", desc: "Tiêu đề" },
      { key: "{message}", desc: "Nội dung" },
      { key: "{time}", desc: "Thời gian" },
    ],
  },
} as const

export type MailTemplateKey = keyof typeof MAIL_TEMPLATE_KEYS

// ═══ Style helpers (premium dark email) ═══════════════════════════════════

function wrap(accent: string, icon: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
<tr><td style="height:4px;background:linear-gradient(90deg,${accent},#a855f7,${accent})"></td></tr>
<tr><td style="padding:32px 40px 0;text-align:center">
<div style="display:inline-block;width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,${accent}33,${accent}11);border:1px solid ${accent}44;line-height:56px;font-size:28px;text-align:center">${icon}</div>
<h1 style="margin:16px 0 0;font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px">{title}</h1>
</td></tr>
<tr><td style="padding:24px 40px 32px">${inner}</td></tr>
<tr><td style="padding:0 40px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.06)">
<p style="margin:20px 0 4px;font-size:11px;color:#64748b">© ${new Date().getFullYear()} {title} — Mọi quyền được bảo lưu.</p>
<p style="margin:0;font-size:11px;color:#475569"><a href="{domain}" style="color:${accent};text-decoration:none">{domain}</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>`
}

const heading = (t: string) =>
  `<h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f1f5f9;text-align:center;letter-spacing:-0.3px">${t}</h2>`

const subtext = (t: string) =>
  `<p style="margin:0 0 24px;font-size:14px;color:#94a3b8;text-align:center;line-height:1.6">${t}</p>`

const otpBox = () =>
  `<div style="text-align:center;margin:24px 0"><div style="display:inline-block;background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03));border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px 32px"><span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#fff;font-family:'Courier New',monospace">{otp}</span></div></div>
<p style="text-align:center;margin:0;font-size:12px;color:#64748b">⏱ Mã có hiệu lực trong 5 phút · Không chia sẻ mã này</p>`

const infoRow = (label: string, value: string) =>
  `<tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid rgba(255,255,255,0.04)">${label}</td><td style="padding:8px 0;font-size:13px;color:#e2e8f0;text-align:right;font-weight:500;border-bottom:1px solid rgba(255,255,255,0.04)">${value}</td></tr>`

const infoCard = (rows: string) =>
  `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:4px 20px;margin:20px 0"><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></div>`

const ctaBtn = (href: string, label: string, color: string) =>
  `<div style="text-align:center;margin:28px 0 8px"><a href="${href}" style="display:inline-block;background:linear-gradient(135deg,${color},${color}cc);color:#fff;padding:12px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.3px;box-shadow:0 4px 16px ${color}44">${label}</a></div>`

const amountHL = (amount: string, color: string) =>
  `<div style="text-align:center;margin:20px 0"><div style="display:inline-block;background:linear-gradient(135deg,${color}22,${color}11);border:1px solid ${color}33;border-radius:12px;padding:12px 28px"><span style="font-size:24px;font-weight:800;color:${color}">${amount}</span></div></div>`

// ═══ Default titles + bodies ═══════════════════════════════════════════════

const DEFAULT_TITLES: Record<MailTemplateKey, string> = {
  verify_email: "✉️ Xác minh email - {title}",
  login: "🔔 Thông báo đăng nhập - {title}",
  forgot_password: "🔑 Khôi phục mật khẩu - {title}",
  change_password: "🔒 Đổi mật khẩu thành công - {title}",
  deposit_success: "💰 Nạp tiền thành công - {title}",
  order_website: "🛒 Xác nhận mua Mã nguồn - {title}",
  order_domain: "🌐 Xác nhận đăng ký tên miền - {title}",
  order_cronjob: "⏰ Xác nhận mua CronJob - {title}",
  renew_cronjob: "🔄 Gia hạn CronJob thành công - {title}",
  order_logo: "🎨 Xác nhận đặt Logo - {title}",
  order_status: "📦 Cập nhật đơn hàng - {title}",
  ticket_reply: "💬 Phản hồi yêu cầu hỗ trợ - {title}",
}

const DEFAULT_BODIES: Record<MailTemplateKey, string> = {
  verify_email: wrap("#10b981", "✉️", `
${heading("Xác minh email")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>! Sử dụng mã OTP bên dưới để xác minh email của bạn`)}
${otpBox()}`),

  login: wrap("#3b82f6", "🔔", `
${heading("Phát hiện đăng nhập mới")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, tài khoản của bạn vừa được đăng nhập`)}
${infoCard(infoRow("📍 Địa chỉ IP", "{ip}") + infoRow("💻 Thiết bị", "{device}") + infoRow("🕐 Thời gian", "{time}"))}
<p style="text-align:center;margin:16px 0 0;padding:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);border-radius:8px;font-size:12px;color:#fca5a5">⚠️ Nếu không phải bạn, hãy <a href="{domain}/customer/profile" style="color:#f87171;font-weight:600">đổi mật khẩu ngay</a></p>
${ctaBtn("{domain}", "Truy cập {title}", "#3b82f6")}`),

  forgot_password: wrap("#f59e0b", "🔑", `
${heading("Khôi phục mật khẩu")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, bạn đã yêu cầu đặt lại mật khẩu. Nhấn nút bên dưới để tạo mật khẩu mới`)}
${ctaBtn("{reset_link}", "Đặt lại mật khẩu", "#f59e0b")}
<p style="text-align:center;margin:16px 0 0;font-size:12px;color:#64748b">⏱ Liên kết có hiệu lực trong 30 phút · Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>`),

  change_password: wrap("#ef4444", "🔒", `
${heading("Mật khẩu đã được thay đổi")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, mật khẩu tài khoản đã được cập nhật thành công`)}
${infoCard(infoRow("📍 IP", "{ip}") + infoRow("💻 Thiết bị", "{device}") + infoRow("🕐 Thời gian", "{time}"))}
<p style="text-align:center;margin:16px 0 0;padding:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);border-radius:8px;font-size:13px;color:#fca5a5;font-weight:600">⚠️ Nếu không phải bạn, liên hệ hỗ trợ ngay!</p>`),

  deposit_success: wrap("#22c55e", "💰", `
${heading("Nạp tiền thành công")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, giao dịch nạp tiền đã hoàn tất`)}
${amountHL("+{amount}", "#22c55e")}
${infoCard(infoRow("💳 Phương thức", "{method}") + infoRow("💰 Số dư", "{balance}") + infoRow("🕐 Thời gian", "{time}"))}
${ctaBtn("{domain}/customer/deposit", "Xem lịch sử", "#22c55e")}`),

  order_website: wrap("#a855f7", "🛒", `
${heading("Mua Mã nguồn thành công")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, đơn hàng đã được xử lý`)}
${infoCard(infoRow("🛍️ Sản phẩm", "{product_name}") + infoRow("💵 Tổng tiền", "{total}") + infoRow("🕐 Thời gian", "{time}"))}
${ctaBtn("{domain}/customer/history", "Xem đơn hàng", "#a855f7")}`),

  order_domain: wrap("#06b6d4", "🌐", `
${heading("Đăng ký tên miền")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, tên miền đã được đăng ký`)}
${amountHL("{domain_name}", "#06b6d4")}
${infoCard(infoRow("💵 Tổng tiền", "{total}") + infoRow("🕐 Thời gian", "{time}"))}
${ctaBtn("{domain}/customer/history", "Quản lý tên miền", "#06b6d4")}`),

  order_cronjob: wrap("#f97316", "⏰", `
${heading("Mua CronJob thành công")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, dịch vụ CronJob đã được kích hoạt`)}
${infoCard(infoRow("🔗 URL", "{url}") + infoRow("⚡ Interval", "{interval}s") + infoRow("📅 Thời hạn", "{months} tháng") + infoRow("💵 Tổng tiền", "{total}") + infoRow("🕐 Thời gian", "{time}"))}
${ctaBtn("{domain}/customer/history", "Quản lý CronJob", "#f97316")}`),

  renew_cronjob: wrap("#f97316", "🔄", `
${heading("Gia hạn CronJob")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, CronJob của bạn đã được gia hạn`)}
${infoCard(infoRow("🔗 URL", "{url}") + infoRow("📅 Gia hạn", "{months} tháng") + infoRow("💵 Tổng tiền", "{total}") + infoRow("🕐 Thời gian", "{time}"))}
${ctaBtn("{domain}/customer/history", "Quản lý CronJob", "#f97316")}`),

  order_logo: wrap("#ec4899", "🎨", `
${heading("Đặt Logo thành công")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, đơn hàng thiết kế logo đã được tiếp nhận`)}
${infoCard(infoRow("🎨 Đơn hàng", "{logo_name}") + infoRow("🏪 Shop", "{shop_name}") + infoRow("💵 Tổng tiền", "{total}") + infoRow("🕐 Thời gian", "{time}"))}
${ctaBtn("{domain}/customer/history", "Xem đơn hàng", "#ec4899")}`),

  order_status: wrap("#6366f1", "📦", `
${heading("Cập nhật đơn hàng")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, đơn hàng của bạn vừa được cập nhật`)}
${infoCard(infoRow("📋 Loại", "{order_type}") + infoRow("🏷️ Đơn", "{order_name}") + infoRow("📊 Trạng thái", "{status}") + infoRow("🕐 Thời gian", "{time}"))}
${ctaBtn("{domain}/customer/history", "Xem đơn hàng", "#6366f1")}`),

  ticket_reply: wrap("#0ea5e9", "💬", `
${heading("Phản hồi yêu cầu hỗ trợ")}
${subtext(`Chào <strong style="color:#f1f5f9">{username}</strong>, ticket <b>#{ticket_id}</b> - {ticket_title} đã được phản hồi`)}
<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;margin:20px 0;font-size:14px;color:#e2e8f0;line-height:1.6">{message}</div>
<p style="text-align:right;margin:0;font-size:12px;color:#64748b">🕐 {time}</p>
${ctaBtn("{domain}/contact", "Xem ticket", "#0ea5e9")}`),
}

// ═══ API ═══════════════════════════════════════════════════════════════════

export async function getMailTemplate(
  key: MailTemplateKey
): Promise<{ emailTitle: string; emailBody: string }> {
  const titleKey = `mail_tpl_${key}_title`
  const bodyKey = `mail_tpl_${key}_body`
  const opts = await getSiteOptions([titleKey, bodyKey])
  return {
    emailTitle: opts[titleKey] || DEFAULT_TITLES[key],
    emailBody: opts[bodyKey] || DEFAULT_BODIES[key],
  }
}

export async function getAllMailTemplates(): Promise<
  Record<MailTemplateKey, { emailTitle: string; emailBody: string }>
> {
  const keys: string[] = []
  for (const k of Object.keys(MAIL_TEMPLATE_KEYS) as MailTemplateKey[]) {
    keys.push(`mail_tpl_${k}_title`, `mail_tpl_${k}_body`)
  }
  const opts = await getSiteOptions(keys)
  const result = {} as Record<MailTemplateKey, { emailTitle: string; emailBody: string }>
  for (const k of Object.keys(MAIL_TEMPLATE_KEYS) as MailTemplateKey[]) {
    result[k] = {
      emailTitle: opts[`mail_tpl_${k}_title`] || DEFAULT_TITLES[k],
      emailBody: opts[`mail_tpl_${k}_body`] || DEFAULT_BODIES[k],
    }
  }
  return result
}

export async function saveMailTemplate(
  key: MailTemplateKey,
  emailTitle: string,
  emailBody: string
): Promise<void> {
  await setSiteOption(`mail_tpl_${key}_title`, emailTitle)
  await setSiteOption(`mail_tpl_${key}_body`, emailBody)
}

/** Replace `{var}` placeholders. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = key.startsWith("{") ? key : `{${key}}`
    result = result.replaceAll(placeholder, value)
  }
  return result
}

/**
 * Get + render template trong 1 call. Auto-fill {title}+{domain} từ site options
 * nếu caller không truyền (tránh `{title}` raw lọt vào email).
 *
 * - {title}  ← setting key `site_title` (fallback "System")
 * - {domain} ← env NEXT_PUBLIC_APP_URL (fallback "#")
 */
export async function buildEmail(
  key: MailTemplateKey,
  vars: Record<string, string>
): Promise<{ subject: string; html: string }> {
  const needTitle = !vars.title
  const needDomain = !vars.domain
  if (needTitle) {
    try {
      const opts = await getSiteOptions(["site_title"])
      vars.title = opts.site_title || "System"
    } catch {
      vars.title = "System"
    }
  }
  if (needDomain) {
    let d = (process.env.NEXT_PUBLIC_APP_URL || "").trim()
    if (d && !/^https?:\/\//i.test(d)) d = `https://${d}`
    vars.domain = d || "#"
  }
  const tpl = await getMailTemplate(key)
  return {
    subject: renderTemplate(tpl.emailTitle, vars),
    html: renderTemplate(tpl.emailBody, vars),
  }
}
