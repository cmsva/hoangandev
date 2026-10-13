/**
 * Telegram Template Engine — Admin + User templates.
 *
 * Storage: settings collection key `tele_tpl_{key}`.
 * Format: Telegram HTML (parse_mode=HTML).
 *
 * 2 nhóm:
 *   - admin_*  Gửi tới admin chat (telegram_chat_id)
 *   - user_*   Gửi tới user (user.telegramId — đã liên kết qua bot client)
 */
import { getSiteOptions, setSiteOption } from "@/models/setting.model"

// ═══ Catalog ═══════════════════════════════════════════════════════════════

export const TELEGRAM_TEMPLATE_KEYS = {
  // ─── ADMIN templates ───────────────────────────────────────────────────
  admin_register: {
    label: "Đăng ký thành viên mới",
    desc: "Khi có User mới đăng ký",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{email}", "{ip}", "{device}", "{ref}", "{time}"],
  },
  admin_deposit: {
    label: "Nạp tiền",
    desc: "Khi User nạp tiền thành công",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{amount}", "{method}", "{trans_id}", "{time}"],
  },
  admin_invoice: {
    label: "Tạo hóa đơn",
    desc: "Khi User tạo hóa đơn nạp tiền bank",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{amount}", "{price}", "{method}", "{time}"],
  },
  admin_card_recharge: {
    label: "Nạp thẻ cào",
    desc: "Khi User nạp thẻ cào thành công",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{amount}", "{price}", "{method}", "{time}"],
  },
  admin_order_website: {
    label: "Mua Mã nguồn",
    desc: "Khi User mua source code",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{product_name}", "{total}", "{time}"],
  },
  admin_order_domain: {
    label: "Đăng ký Tên miền",
    desc: "Khi User đăng ký domain",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{domain_name}", "{total}", "{time}"],
  },
  admin_order_cronjob: {
    label: "Mua CronJob",
    desc: "Khi User thuê CronJob",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{url}", "{interval}", "{months}", "{total}", "{time}"],
  },
  admin_renew_cronjob: {
    label: "Gia hạn CronJob",
    desc: "Khi User gia hạn CronJob",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{url}", "{months}", "{total}", "{time}"],
  },
  admin_order_logo: {
    label: "Đặt Logo",
    desc: "Khi User đặt thiết kế logo",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{logo_name}", "{shop_name}", "{total}", "{time}"],
  },
  admin_ticket_new: {
    label: "Ticket mới",
    desc: "Khi User tạo ticket hỗ trợ",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{ticket_id}", "{title}", "{time}"],
  },
  admin_deploy_step: {
    label: "Deploy website — tiến độ",
    desc: "Báo từng bước khi worker tạo website tự động",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{domain_name}", "{step}", "{status}", "{time}"],
  },
  admin_deploy_done: {
    label: "Deploy website — hoàn thành",
    desc: "Báo khi website tạo tự động hoàn tất",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{domain_name}", "{server}", "{time}"],
  },
  admin_deploy_failed: {
    label: "Deploy website — lỗi",
    desc: "Báo khi worker tạo website thất bại",
    group: "admin" as const,
    vars: ["{domain}", "{username}", "{domain_name}", "{step}", "{error}", "{time}"],
  },

  // ─── USER templates ────────────────────────────────────────────────────
  user_link_success: {
    label: "Liên kết thành công",
    desc: "Gửi khi user vừa liên kết Telegram",
    group: "user" as const,
    vars: ["{domain}", "{username}", "{time}"],
  },
  user_login: {
    label: "Đăng nhập",
    desc: "Gửi khi user đăng nhập (yêu cầu liên kết tele)",
    group: "user" as const,
    vars: ["{domain}", "{username}", "{ip}", "{device}", "{time}"],
  },
  user_deposit: {
    label: "Nạp tiền thành công",
    desc: "Gửi khi user nạp tiền hoàn tất",
    group: "user" as const,
    vars: ["{domain}", "{username}", "{amount}", "{method}", "{time}"],
  },
  user_order: {
    label: "Mua dịch vụ thành công",
    desc: "Gửi khi user mua source code/cronjob/logo/domain",
    group: "user" as const,
    vars: ["{domain}", "{username}", "{service}", "{total}", "{time}"],
  },
  user_order_status: {
    label: "Cập nhật đơn hàng",
    desc: "Gửi khi admin cập nhật trạng thái đơn",
    group: "user" as const,
    vars: ["{domain}", "{username}", "{order_type}", "{order_name}", "{status}", "{time}"],
  },
  user_ticket_reply: {
    label: "Phản hồi ticket",
    desc: "Gửi khi admin phản hồi yêu cầu hỗ trợ",
    group: "user" as const,
    vars: ["{domain}", "{username}", "{ticket_id}", "{title}", "{message}", "{time}"],
  },
} as const

export type TelegramTemplateKey = keyof typeof TELEGRAM_TEMPLATE_KEYS

export type TelegramAdminKey = {
  [K in TelegramTemplateKey]: typeof TELEGRAM_TEMPLATE_KEYS[K]["group"] extends "admin" ? K : never
}[TelegramTemplateKey]

export type TelegramUserKey = {
  [K in TelegramTemplateKey]: typeof TELEGRAM_TEMPLATE_KEYS[K]["group"] extends "user" ? K : never
}[TelegramTemplateKey]

// ═══ Defaults ══════════════════════════════════════════════════════════════

const DEFAULTS: Record<TelegramTemplateKey, string> = {
  // ─── ADMIN ───────────────────────────────────────────────────────────────
  admin_register: `👤 <b>Thành viên mới</b>
🆔 Username: {username}
📧 Email: {email}
🌐 IP: {ip}
💻 Thiết bị: {device}
👥 Ref: {ref}
🕐 {time}`,

  admin_deposit: `💰 <b>Nạp tiền thành công</b>
👤 User: {username}
💵 Số tiền: {amount}
💳 Phương thức: {method}
🧾 Mã GD: {trans_id}
🕐 {time}`,

  admin_invoice: `🧾 <b>Hóa đơn nạp tiền mới</b>
👤 User: {username}
💵 Số tiền: {amount}
💰 Thực nhận: {price}
🏦 Ngân hàng: {method}
🕐 {time}`,

  admin_card_recharge: `💳 <b>Nạp thẻ cào</b>
👤 User: {username}
💵 Mệnh giá: {amount}
💰 Thực nhận: {price}
📱 Nhà mạng: {method}
🕐 {time}`,

  admin_order_website: `🛒 <b>Mua mã nguồn</b>
👤 User: {username}
🛍️ Sản phẩm: {product_name}
💵 Số tiền: {total}
🕐 {time}`,

  admin_order_domain: `🌍 <b>Đăng ký Domain</b>
👤 User: {username}
🌐 Domain: {domain_name}
💵 Số tiền: {total}
🕐 {time}`,

  admin_order_cronjob: `⏰ <b>Thuê CronJob</b>
👤 User: {username}
🔗 URL: {url}
⚡ Interval: {interval}s
📅 Thời hạn: {months} tháng
💵 Số tiền: {total}
🕐 {time}`,

  admin_renew_cronjob: `🔄 <b>Gia hạn CronJob</b>
👤 User: {username}
🔗 URL: {url}
📅 Gia hạn: {months} tháng
💵 Số tiền: {total}
🕐 {time}`,

  admin_order_logo: `🎨 <b>Đặt Logo</b>
👤 User: {username}
🎨 Logo: {logo_name}
🏪 Shop: {shop_name}
💵 Số tiền: {total}
🕐 {time}`,

  admin_ticket_new: `🎫 <b>Ticket hỗ trợ mới</b>
👤 User: {username}
🆔 Ticket: #{ticket_id}
📌 Tiêu đề: {title}
🕐 {time}`,

  admin_deploy_step: `⚙️ <b>Deploy website</b>
👤 User: {username}
🌐 Domain: {domain_name}
🔧 Bước: {step}
📊 Trạng thái: {status}
🕐 {time}`,

  admin_deploy_done: `✅ <b>Website tạo xong</b>
👤 User: {username}
🌐 Domain: {domain_name}
🖥️ Server: {server}
🕐 {time}`,

  admin_deploy_failed: `❌ <b>Deploy website lỗi</b>
👤 User: {username}
🌐 Domain: {domain_name}
🔧 Bước: {step}
⚠️ Lỗi: {error}
🕐 {time}`,

  // ─── USER ────────────────────────────────────────────────────────────────
  user_link_success: `🎉 <b>Liên kết thành công!</b>

Chào {username}! Tài khoản tại <b>{domain}</b> đã được liên kết với Telegram này.
Từ giờ bạn sẽ nhận thông báo realtime mỗi khi có hoạt động.

🕐 {time}`,

  user_login: `🔔 Chào {username}!

Tài khoản của bạn vừa đăng nhập tại <b>{domain}</b>.

💻 Thiết bị: {device}
🌐 IP: {ip}
🕐 {time}

⚠️ Nếu không phải bạn, hãy đổi mật khẩu ngay!`,

  user_deposit: `💰 <b>Nạp tiền thành công</b>

Chào {username}, bạn vừa nạp:
💵 Số tiền: {amount}
💳 Phương thức: {method}
🕐 {time}

Cảm ơn bạn đã sử dụng {domain} 🎉`,

  user_order: `🛒 <b>Đơn hàng thành công</b>

Chào {username}, bạn vừa mua:
🛠️ Dịch vụ: {service}
💵 Tổng tiền: {total}
🕐 {time}

Cảm ơn bạn đã tin tưởng {domain} 🎉`,

  user_order_status: `📦 <b>Cập nhật đơn hàng</b>

Chào {username}, đơn hàng của bạn đã được cập nhật:
📋 Loại: {order_type}
🛠️ Đơn: {order_name}
✅ Trạng thái: {status}
🕐 {time}

Xem chi tiết tại {domain}`,

  user_ticket_reply: `📩 <b>Phản hồi yêu cầu hỗ trợ</b>

Chào {username}, ticket <b>#{ticket_id}</b> - {title} đã được phản hồi:

💬 {message}

🕐 {time}
Xem chi tiết tại {domain}`,
}

// ═══ API ═══════════════════════════════════════════════════════════════════

export async function getTelegramTemplate(key: TelegramTemplateKey): Promise<string> {
  const optKey = `tele_tpl_${key}`
  const opts = await getSiteOptions([optKey])
  return opts[optKey] || DEFAULTS[key]
}

export async function getAllTelegramTemplates(): Promise<Record<TelegramTemplateKey, string>> {
  const keys = Object.keys(TELEGRAM_TEMPLATE_KEYS) as TelegramTemplateKey[]
  const optKeys = keys.map((k) => `tele_tpl_${k}`)
  const opts = await getSiteOptions(optKeys)
  const result = {} as Record<TelegramTemplateKey, string>
  for (const k of keys) {
    result[k] = opts[`tele_tpl_${k}`] || DEFAULTS[k]
  }
  return result
}

export async function saveTelegramTemplate(
  key: TelegramTemplateKey,
  content: string
): Promise<void> {
  await setSiteOption(`tele_tpl_${key}`, content)
}

export function renderTelegramTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = key.startsWith("{") ? key : `{${key}}`
    result = result.replaceAll(placeholder, value)
  }
  return result
}

/** Auto-fill {domain} từ env NEXT_PUBLIC_APP_URL nếu thiếu. */
export async function buildTelegramMessage(
  key: TelegramTemplateKey,
  vars: Record<string, string>
): Promise<string> {
  if (!vars.domain) {
    let d = (process.env.NEXT_PUBLIC_APP_URL || "").trim()
    if (d && !/^https?:\/\//i.test(d)) d = `https://${d}`
    vars.domain = d || "localhost"
  }
  const tpl = await getTelegramTemplate(key)
  return renderTelegramTemplate(tpl, vars)
}
