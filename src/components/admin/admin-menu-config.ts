import type { ComponentType } from "react"
import {
  IconDashboard,
  IconClock,
  IconBracketsCurly,
  IconLink,
  IconBrush,
  IconMonitor,
  IconUsers,
  IconWallet,
  IconCreditCard,
  IconDollarCircle,
  IconTicket,
  IconShield,
  IconDocument,
  IconBell,
} from "@/components/icons"

export interface AdminNavItem {
  href: string
  label: string
  exact?: boolean
}

export interface AdminNavSection {
  label: string
  href?: string
  icon?: ComponentType<{ size?: number; className?: string }>
  items?: AdminNavItem[]
  group?: string
}

export const adminNavSections: AdminNavSection[] = [
  // ─── MAIN ───────────────────────────────────────────────────────────
  {
    label: "Tổng quan",
    href: "/adminPanel/dashboard",
    icon: IconDashboard,
    group: "MAIN",
  },
  {
    label: "Lịch sử",
    icon: IconClock,
    group: "MAIN",
    items: [
      { href: "/adminPanel/logs/activity", label: "Nhật ký hoạt động" },
      { href: "/adminPanel/logs/balance", label: "Biến động số dư" },
    ],
  },

  // ─── DỊCH VỤ ────────────────────────────────────────────────────────
  {
    label: "Mã nguồn",
    icon: IconBracketsCurly,
    group: "DỊCH VỤ",
    items: [
      { href: "/adminPanel/source-code/categories", label: "Danh mục" },
      { href: "/adminPanel/source-code/products", label: "Sản phẩm" },
      { href: "/adminPanel/source-code/orders", label: "Đơn hàng" },
    ],
  },
  {
    label: "Tên miền",
    icon: IconLink,
    group: "DỊCH VỤ",
    items: [
      { href: "/adminPanel/domains/pricing", label: "Bảng giá" },
      { href: "/adminPanel/domains/orders", label: "Đơn hàng" },
    ],
  },
  {
    label: "Cron Jobs",
    icon: IconClock,
    group: "DỊCH VỤ",
    items: [
      { href: "/adminPanel/cronjobs/servers", label: "Máy chủ" },
      { href: "/adminPanel/cronjobs/orders", label: "Đơn hàng" },
    ],
  },
  {
    label: "Logo",
    icon: IconBrush,
    group: "DỊCH VỤ",
    items: [
      { href: "/adminPanel/logos/categories", label: "Danh mục" },
      { href: "/adminPanel/logos/list", label: "Logo mẫu" },
      { href: "/adminPanel/logos/orders", label: "Đơn hàng" },
    ],
  },
  {
    label: "Website",
    icon: IconMonitor,
    group: "DỊCH VỤ",
    items: [
      { href: "/adminPanel/websites/categories", label: "Danh mục website" },
      { href: "/adminPanel/websites/templates", label: "Danh sách website" },
      { href: "/adminPanel/websites/orders", label: "Đơn hàng website" },
      { href: "/adminPanel/websites/deploy-codes", label: "Code deploy" },
      { href: "/adminPanel/websites/aapanel", label: "Cấu hình aaPanel" },
      { href: "/adminPanel/websites/cloudflare", label: "Cấu hình Cloudflare" },
    ],
  },

  // ─── QUẢN LÝ ────────────────────────────────────────────────────────
  {
    label: "Khách hàng",
    href: "/adminPanel/users",
    icon: IconUsers,
    group: "QUẢN LÝ",
  },
  {
    label: "Tài chính",
    icon: IconWallet,
    group: "QUẢN LÝ",
    items: [
      { href: "/adminPanel/deposit/card", label: "Thẻ cào" },
      { href: "/adminPanel/deposit/bank", label: "Ngân hàng" },
    ],
  },
  {
    label: "Bài viết",
    icon: IconDocument,
    group: "QUẢN LÝ",
    items: [
      { href: "/adminPanel/posts/write", label: "Viết bài mới", exact: true },
      { href: "/adminPanel/posts", label: "Tất cả bài viết", exact: true },
      { href: "/adminPanel/posts/categories", label: "Chuyên mục" },
    ],
  },
  {
    label: "Tiếp thị liên kết",
    icon: IconDollarCircle,
    group: "QUẢN LÝ",
    items: [
      { href: "/adminPanel/affiliate/logs", label: "Nhật ký hoa hồng" },
      { href: "/adminPanel/affiliate/withdraw", label: "Yêu cầu rút" },
      { href: "/adminPanel/affiliate/config", label: "Cấu hình" },
    ],
  },
  {
    label: "Mã giảm giá",
    href: "/adminPanel/coupons",
    icon: IconCreditCard,
    group: "QUẢN LÝ",
  },
  {
    label: "Khuyến mãi nạp",
    href: "/adminPanel/promotions",
    icon: IconBell,
    group: "QUẢN LÝ",
  },

  // ─── HỖ TRỢ & MARKETING ──────────────────────────────────────────────
  {
    label: "Vé hỗ trợ",
    href: "/adminPanel/tickets",
    icon: IconTicket,
    group: "HỖ TRỢ & MARKETING",
  },
  {
    label: "Thông báo",
    href: "/adminPanel/notifications",
    icon: IconBell,
    group: "HỖ TRỢ & MARKETING",
  },
  {
    label: "Chiến dịch mail",
    href: "/adminPanel/mail-campaigns",
    icon: IconDocument,
    group: "HỖ TRỢ & MARKETING",
  },
  {
    label: "Chiến dịch Telegram",
    href: "/adminPanel/telegram-campaigns",
    icon: IconBell,
    group: "HỖ TRỢ & MARKETING",
  },

  // ─── HỆ THỐNG ───────────────────────────────────────────────────────
  {
    label: "Hệ thống",
    icon: IconShield,
    group: "HỆ THỐNG",
    items: [
      { href: "/adminPanel/settings", label: "Cài đặt chung" },
      { href: "/adminPanel/media", label: "Thư viện ảnh" },
      { href: "/adminPanel/system-status", label: "Trạng thái hệ thống" },
      { href: "/adminPanel/ip-block", label: "Chặn truy cập" },
      { href: "/adminPanel/extensions", label: "Gói mở rộng" },
      { href: "/adminPanel/static-pages", label: "Trang tĩnh" },
      { href: "/adminPanel/seo", label: "Cấu hình SEO" },
    ],
  },
]

export const adminNavGroups = ["MAIN", "DỊCH VỤ", "QUẢN LÝ", "HỖ TRỢ & MARKETING", "HỆ THỐNG"] as const

export function getAdminGroupedSections() {
  return adminNavGroups
    .map((group) => ({
      group,
      items: adminNavSections.filter((s) => s.group === group),
    }))
    .filter((g) => g.items.length > 0)
}

/**
 * Check active state cho admin nav.
 * - exact=false: prefix match (e.g. /adminPanel/users matches /adminPanel/users/123)
 * - exact=true: exact match
 */
export function adminActivePath(
  pathname: string,
  href: string,
  exact = false
): boolean {
  if (pathname === href) return true
  if (!exact && pathname.startsWith(href + "/")) return true
  return false
}
