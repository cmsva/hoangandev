/**
 * Status chuẩn cho mọi đơn hàng "thủ công" cần admin xử lý.
 * Áp dụng cho: logo, banner, dịch vụ design, services khác.
 *
 * Logo không dùng "expired" vì là mua đứt 1 lượt.
 * Domain/Cronjob/Hosting có "expired" riêng.
 */

export const MANUAL_ORDER_STATUSES = [
  "pending",
  "completed",
  "cancelled",
  "cancelled_refund",
  "error_refund",
  "suspended",
] as const

export type ManualOrderStatus = (typeof MANUAL_ORDER_STATUSES)[number]

export const MANUAL_ORDER_STATUS_LABELS: Record<
  ManualOrderStatus,
  { label: string; color: string }
> = {
  pending: {
    label: "Đang xử lý",
    color:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  },
  completed: {
    label: "Hoạt động",
    color:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  },
  cancelled: {
    label: "Đã hủy",
    color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 ring-gray-500/20",
  },
  cancelled_refund: {
    label: "Đã hủy (Hoàn tiền)",
    color:
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20",
  },
  error_refund: {
    label: "Lỗi (Hoàn tiền)",
    color:
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20",
  },
  suspended: {
    label: "Tạm khóa",
    color:
      "bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20",
  },
}

/**
 * Trả về cấu hình badge (label + color) cho status.
 * Fallback an toàn nếu status lạ.
 */
export function getManualOrderStatusBadge(status: string) {
  return (
    MANUAL_ORDER_STATUS_LABELS[status as ManualOrderStatus] ?? {
      label: status,
      color:
        "bg-gray-500/10 text-gray-500 dark:text-gray-400 ring-gray-500/20",
    }
  )
}

/**
 * Status cho service có duration (website, hosting...). Mở rộng manual + thêm:
 *  - active           : Service đang chạy
 *  - expired          : Hết hạn
 */
export const SERVICE_ORDER_STATUSES = [
  "pending",
  "cf_pending",
  "domain_buying",
  "domain_failed",
  "ns_pending",
  "processing",
  "failed",
  "active",
  "expired",
  "cancelled",
  "cancelled_refund",
  "error_refund",
  "suspended",
] as const

export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number]

export const SERVICE_ORDER_STATUS_LABELS: Record<
  ServiceOrderStatus,
  { label: string; color: string }
> = {
  pending: {
    label: "Đang xử lý",
    color:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  },
  cf_pending: {
    label: "Đang tạo Cloudflare",
    color:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20",
  },
  domain_buying: {
    label: "Đang đăng ký tên miền",
    color:
      "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20",
  },
  domain_failed: {
    label: "Đăng ký tên miền thất bại",
    color:
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20",
  },
  ns_pending: {
    label: "Chờ trỏ NS",
    color:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  },
  processing: {
    label: "Đang tạo tự động",
    color:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20",
  },
  failed: {
    label: "Tạo thất bại",
    color:
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20",
  },
  active: {
    label: "Đang chạy",
    color:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  },
  expired: {
    label: "Hết hạn",
    color:
      "bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-500/20",
  },
  cancelled: {
    label: "Đã hủy",
    color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 ring-gray-500/20",
  },
  cancelled_refund: {
    label: "Đã hủy (Hoàn tiền)",
    color:
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20",
  },
  error_refund: {
    label: "Lỗi (Hoàn tiền)",
    color:
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20",
  },
  suspended: {
    label: "Tạm khóa",
    color:
      "bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20",
  },
}

export function getServiceOrderStatusBadge(status: string) {
  return (
    SERVICE_ORDER_STATUS_LABELS[status as ServiceOrderStatus] ?? {
      label: status,
      color:
        "bg-gray-500/10 text-gray-500 dark:text-gray-400 ring-gray-500/20",
    }
  )
}
